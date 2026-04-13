import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CALENDLY_API = "https://api.calendly.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function calendlyFetch(apiToken: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${CALENDLY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`[calendly-api] Calendly API error ${res.status}:`, data);
    throw new Error(data.message || `Calendly API error ${res.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path: /calendly-api/<action>
  const action = pathParts[pathParts.length - 1] || "";

  try {
    // --- CONNECT: Save API token and fetch user info ---
    if (action === "connect" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      const userId = await getUserIdFromAuth(authHeader);
      if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

      const { workspaceId, apiToken } = await req.json();
      if (!workspaceId || !apiToken) {
        return new Response(JSON.stringify({ error: "workspaceId and apiToken required" }), { status: 400, headers: corsHeaders });
      }

      // Check if workspace is allowed
      const { data: allowed } = await supabaseAdmin
        .from("calendly_allowed_workspaces")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Calendly not available for this workspace" }), { status: 403, headers: corsHeaders });
      }

      // Validate token by fetching user info
      const userInfo = await calendlyFetch(apiToken, "/users/me");
      const calendlyUserUri = userInfo.resource?.uri;
      const calendlyEmail = userInfo.resource?.email;
      const schedulingUrl = userInfo.resource?.scheduling_url;

      // Fetch default event type
      let defaultEventTypeUri: string | null = null;
      try {
        const eventTypes = await calendlyFetch(apiToken, `/event_types?user=${encodeURIComponent(calendlyUserUri)}&active=true&count=1`);
        if (eventTypes.collection?.length > 0) {
          defaultEventTypeUri = eventTypes.collection[0].uri;
        }
      } catch (e) {
        console.warn("[calendly-api] Could not fetch event types:", e);
      }

      // Upsert connection
      const { error: dbError } = await supabaseAdmin
        .from("calendly_connections")
        .upsert({
          workspace_id: workspaceId,
          user_id: userId,
          api_token: apiToken,
          calendly_user_uri: calendlyUserUri,
          calendly_email: calendlyEmail,
          scheduling_url: schedulingUrl,
          default_event_type_uri: defaultEventTypeUri,
          sync_enabled: true,
        }, { onConflict: "workspace_id" });

      if (dbError) {
        console.error("[calendly-api] DB error:", dbError);
        return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers: corsHeaders });
      }

      console.log(`[calendly-api] ✅ Connected: ${calendlyEmail} for workspace ${workspaceId}`);
      return new Response(JSON.stringify({
        success: true,
        email: calendlyEmail,
        schedulingUrl,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- DISCONNECT ---
    if (action === "disconnect" && req.method === "DELETE") {
      const authHeader = req.headers.get("Authorization");
      const userId = await getUserIdFromAuth(authHeader);
      if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

      const { workspaceId } = await req.json();
      const { error } = await supabaseAdmin
        .from("calendly_connections")
        .delete()
        .eq("workspace_id", workspaceId);

      if (error) return new Response(JSON.stringify({ error: "Failed to disconnect" }), { status: 500, headers: corsHeaders });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- EVENT TYPES: List available event types ---
    if (action === "event-types" && req.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      if (!workspaceId) return new Response(JSON.stringify({ error: "workspaceId required" }), { status: 400, headers: corsHeaders });

      const conn = await getConnection(workspaceId);
      if (!conn) return new Response(JSON.stringify({ error: "Not connected" }), { status: 404, headers: corsHeaders });

      const eventTypes = await calendlyFetch(conn.api_token, `/event_types?user=${encodeURIComponent(conn.calendly_user_uri)}&active=true`);
      return new Response(JSON.stringify(eventTypes.collection || []), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- SCHEDULING LINK: Get scheduling link for a specific event type ---
    if (action === "scheduling-link" && req.method === "POST") {
      const { workspaceId, eventTypeUri } = await req.json();
      if (!workspaceId) return new Response(JSON.stringify({ error: "workspaceId required" }), { status: 400, headers: corsHeaders });

      const conn = await getConnection(workspaceId);
      if (!conn) return new Response(JSON.stringify({ error: "Not connected" }), { status: 404, headers: corsHeaders });

      // If specific event type requested, build URL from it. Otherwise use default scheduling URL
      if (eventTypeUri) {
        // Get event type details to build scheduling URL
        const eventType = await calendlyFetch(conn.api_token, `/event_types/${eventTypeUri.split("/").pop()}`);
        return new Response(JSON.stringify({
          schedulingUrl: eventType.resource?.scheduling_url || conn.scheduling_url,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        schedulingUrl: conn.scheduling_url,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- AVAILABILITY: Check available slots ---
    if (action === "availability" && req.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      const startTime = url.searchParams.get("start_time");
      const endTime = url.searchParams.get("end_time");
      if (!workspaceId || !startTime || !endTime) {
        return new Response(JSON.stringify({ error: "workspaceId, start_time, end_time required" }), { status: 400, headers: corsHeaders });
      }

      const conn = await getConnection(workspaceId);
      if (!conn) return new Response(JSON.stringify({ error: "Not connected" }), { status: 404, headers: corsHeaders });

      const eventTypeUri = conn.default_event_type_uri;
      if (!eventTypeUri) {
        return new Response(JSON.stringify({ error: "No event type configured" }), { status: 400, headers: corsHeaders });
      }

      const eventTypeUuid = eventTypeUri.split("/").pop();
      const availability = await calendlyFetch(
        conn.api_token,
        `/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}&start_time=${startTime}&end_time=${endTime}`
      );

      return new Response(JSON.stringify(availability.collection || []), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- SCHEDULED EVENTS: List scheduled events ---
    if (action === "events" && req.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      const minStartTime = url.searchParams.get("min_start_time");
      const maxStartTime = url.searchParams.get("max_start_time");
      const status = url.searchParams.get("status") || "active";
      if (!workspaceId) return new Response(JSON.stringify({ error: "workspaceId required" }), { status: 400, headers: corsHeaders });

      const conn = await getConnection(workspaceId);
      if (!conn) return new Response(JSON.stringify({ error: "Not connected" }), { status: 404, headers: corsHeaders });

      let path = `/scheduled_events?user=${encodeURIComponent(conn.calendly_user_uri)}&status=${status}`;
      if (minStartTime) path += `&min_start_time=${minStartTime}`;
      if (maxStartTime) path += `&max_start_time=${maxStartTime}`;
      path += `&sort=start_time:asc&count=50`;

      const events = await calendlyFetch(conn.api_token, path);
      return new Response(JSON.stringify(events.collection || []), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- CANCEL EVENT ---
    if (action === "cancel" && req.method === "POST") {
      const { workspaceId, eventUuid, reason } = await req.json();
      if (!workspaceId || !eventUuid) {
        return new Response(JSON.stringify({ error: "workspaceId and eventUuid required" }), { status: 400, headers: corsHeaders });
      }

      const conn = await getConnection(workspaceId);
      if (!conn) return new Response(JSON.stringify({ error: "Not connected" }), { status: 404, headers: corsHeaders });

      const result = await calendlyFetch(conn.api_token, `/scheduled_events/${eventUuid}/cancellation`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || "Cancelado pelo sistema" }),
      });

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- SYNC: Pull Calendly events into calendar_events table ---
    if (action === "sync" && req.method === "POST") {
      const { workspaceId } = await req.json();
      if (!workspaceId) return new Response(JSON.stringify({ error: "workspaceId required" }), { status: 400, headers: corsHeaders });

      const conn = await getConnection(workspaceId);
      if (!conn) return new Response(JSON.stringify({ error: "Not connected" }), { status: 404, headers: corsHeaders });

      const now = new Date();
      const minStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const maxStart = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

      let path = `/scheduled_events?user=${encodeURIComponent(conn.calendly_user_uri)}&status=active&min_start_time=${minStart}&max_start_time=${maxStart}&sort=start_time:asc&count=100`;
      const events = await calendlyFetch(conn.api_token, path);
      const calendlyEvents = events.collection || [];

      let imported = 0;
      for (const evt of calendlyEvents) {
        const calendlyEventId = evt.uri.split("/").pop();

        // Check if already exists
        const { data: existing } = await supabaseAdmin
          .from("calendar_events")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("google_event_id", `calendly_${calendlyEventId}`)
          .maybeSingle();

        if (existing) continue;

        // Get invitee info
        let inviteeName = "";
        let inviteeEmail = "";
        try {
          const invitees = await calendlyFetch(conn.api_token, `/scheduled_events/${calendlyEventId}/invitees`);
          if (invitees.collection?.length > 0) {
            inviteeName = invitees.collection[0].name || "";
            inviteeEmail = invitees.collection[0].email || "";
          }
        } catch (e) {
          console.warn("[calendly-api] Could not fetch invitees:", e);
        }

        const title = evt.name + (inviteeName ? ` - ${inviteeName}` : "");
        const location = evt.location?.join_url || evt.location?.location || null;

        const { error: insertErr } = await supabaseAdmin
          .from("calendar_events")
          .insert({
            workspace_id: workspaceId,
            user_id: conn.user_id,
            title,
            description: inviteeEmail ? `Convidado: ${inviteeEmail}` : null,
            start_at: evt.start_time,
            end_at: evt.end_time,
            all_day: false,
            type: "meeting",
            color: "#06B6D4",
            google_event_id: `calendly_${calendlyEventId}`,
            synced_to_google: false,
            location,
            meet_link: evt.location?.join_url || null,
          });

        if (!insertErr) imported++;
      }

      console.log(`[calendly-api] ✅ Synced ${imported} events for workspace ${workspaceId}`);
      return new Response(JSON.stringify({ imported, total: calendlyEvents.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- AI TOOLS (internal, called by ai-agent-chat) ---
    if (action === "ai-get-link" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== serviceRole) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      const { workspaceId } = await req.json();
      const conn = await getConnection(workspaceId);
      if (!conn) return new Response(JSON.stringify({ error: "Not connected", schedulingUrl: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Get all active event types with their details
      let eventTypes: any[] = [];
      try {
        const result = await calendlyFetch(conn.api_token, `/event_types?user=${encodeURIComponent(conn.calendly_user_uri)}&active=true`);
        eventTypes = (result.collection || []).map((et: any) => ({
          name: et.name,
          duration: et.duration,
          schedulingUrl: et.scheduling_url,
          uri: et.uri,
        }));
      } catch (e) {
        console.warn("[calendly-api] Could not fetch event types:", e);
      }

      return new Response(JSON.stringify({
        schedulingUrl: conn.scheduling_url,
        eventTypes,
        calendlyEmail: conn.calendly_email,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "ai-check-availability" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== serviceRole) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      const { workspaceId, startTime, endTime } = await req.json();
      const conn = await getConnection(workspaceId);
      if (!conn || !conn.default_event_type_uri) {
        return new Response(JSON.stringify({ available: false, error: "Not configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const availability = await calendlyFetch(
        conn.api_token,
        `/event_type_available_times?event_type=${encodeURIComponent(conn.default_event_type_uri)}&start_time=${startTime}&end_time=${endTime}`
      );

      const slots = (availability.collection || []).map((s: any) => ({
        start: s.start_time,
        end: s.end_time,
        status: s.status,
      }));

      return new Response(JSON.stringify({ slots }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 404, headers: corsHeaders });
  } catch (err) {
    console.error("[calendly-api] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function getConnection(workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from("calendly_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("sync_enabled", true)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
