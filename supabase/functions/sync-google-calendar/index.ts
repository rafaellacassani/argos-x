import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const app = new Hono().basePath("/sync-google-calendar");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Refresh token if expiring within 5 minutes
async function getValidToken(userId: string): Promise<string | null> {
  const { data: tokenRow, error } = await supabaseAdmin
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) return null;

  const expiresAt = new Date(tokenRow.token_expiry).getTime();
  const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

  if (expiresAt > fiveMinFromNow) {
    return tokenRow.access_token;
  }

  // Refresh
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-oauth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

// POST /push - Push event to Google Calendar
app.post("/push", async (c) => {
  let eventId: string;
  try {
    const body = await c.req.json();
    eventId = body.eventId;
    if (!eventId) throw new Error();
  } catch {
    return c.json({ error: "eventId is required" }, 400, corsHeaders);
  }

  try {
    const { data: event, error } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error || !event) {
      return c.json({ error: "Event not found" }, 404, corsHeaders);
    }

    const accessToken = await getValidToken(event.user_id);
    if (!accessToken) {
      return c.json({ error: "No valid Google token" }, 401, corsHeaders);
    }

    // Get calendar ID
    const { data: tokenRow } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("google_calendar_id")
      .eq("user_id", event.user_id)
      .single();

    const calendarId = tokenRow?.google_calendar_id || "primary";

    const googleEvent = {
      summary: event.title,
      description: event.description || "",
      location: event.location || "",
      start: event.all_day
        ? { date: event.start_at.split("T")[0] }
        : { dateTime: event.start_at, timeZone: "America/Sao_Paulo" },
      end: event.all_day
        ? { date: event.end_at.split("T")[0] }
        : { dateTime: event.end_at, timeZone: "America/Sao_Paulo" },
    };

    let googleRes: Response;
    if (event.google_event_id) {
      // Update existing
      googleRes = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${event.google_event_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googleEvent),
        }
      );
    } else {
      // Create new
      googleRes = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googleEvent),
        }
      );
    }

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      console.error("[Sync Google] Push failed:", googleData);
      return c.json({ error: "Google API error" }, 500, corsHeaders);
    }

    // Update local event
    await supabaseAdmin
      .from("calendar_events")
      .update({
        google_event_id: googleData.id,
        synced_to_google: true,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    return c.json({ success: true, googleEventId: googleData.id }, 200, corsHeaders);
  } catch (err) {
    console.error("[Sync Google] Push error:", err);
    return c.json({ error: "Internal error" }, 500, corsHeaders);
  }
});

// DELETE /delete - Delete event from Google Calendar
app.delete("/delete", async (c) => {
  let eventId: string;
  try {
    const body = await c.req.json();
    eventId = body.eventId;
    if (!eventId) throw new Error();
  } catch {
    return c.json({ error: "eventId is required" }, 400, corsHeaders);
  }

  try {
    const { data: event, error } = await supabaseAdmin
      .from("calendar_events")
      .select("user_id, google_event_id")
      .eq("id", eventId)
      .single();

    if (error || !event) {
      return c.json({ error: "Event not found" }, 404, corsHeaders);
    }

    if (!event.google_event_id) {
      return c.json({ success: true, message: "No Google event to delete" }, 200, corsHeaders);
    }

    const accessToken = await getValidToken(event.user_id);
    if (!accessToken) {
      return c.json({ error: "No valid Google token" }, 401, corsHeaders);
    }

    const { data: tokenRow } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("google_calendar_id")
      .eq("user_id", event.user_id)
      .single();

    const calendarId = tokenRow?.google_calendar_id || "primary";

    await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${event.google_event_id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return c.json({ success: true }, 200, corsHeaders);
  } catch (err) {
    console.error("[Sync Google] Delete error:", err);
    return c.json({ error: "Internal error" }, 500, corsHeaders);
  }
});

// POST /pull - Pull events from Google Calendar
app.post("/pull", async (c) => {
  let userId: string;
  let daysAhead = 30;
  try {
    const body = await c.req.json();
    userId = body.userId;
    if (body.daysAhead) daysAhead = body.daysAhead;
    if (!userId) throw new Error();
  } catch {
    return c.json({ error: "userId is required" }, 400, corsHeaders);
  }

  try {
    const accessToken = await getValidToken(userId);
    if (!accessToken) {
      return c.json({ error: "No valid Google token" }, 401, corsHeaders);
    }

    const { data: tokenRow } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("google_calendar_id, workspace_id")
      .eq("user_id", userId)
      .single();

    if (!tokenRow) {
      return c.json({ error: "Token not found" }, 404, corsHeaders);
    }

    const calendarId = tokenRow.google_calendar_id || "primary";
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events`);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    if (!res.ok) {
      console.error("[Sync Google] Pull failed:", data);
      return c.json({ error: "Google API error" }, 500, corsHeaders);
    }

    const events = data.items || [];
    let imported = 0;

    for (const gEvent of events) {
      if (!gEvent.id) continue;

      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("google_event_id", gEvent.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) continue;

      const startAt = gEvent.start?.dateTime || `${gEvent.start?.date}T00:00:00Z`;
      const endAt = gEvent.end?.dateTime || `${gEvent.end?.date}T23:59:59Z`;
      const allDay = !gEvent.start?.dateTime;

      await supabaseAdmin.from("calendar_events").insert({
        workspace_id: tokenRow.workspace_id,
        user_id: userId,
        title: gEvent.summary || "(Sem título)",
        description: gEvent.description || null,
        start_at: startAt,
        end_at: endAt,
        all_day: allDay,
        location: gEvent.location || null,
        google_event_id: gEvent.id,
        synced_to_google: true,
        last_synced_at: new Date().toISOString(),
        type: "meeting",
      });

      imported++;
    }

    console.log(`[Sync Google] Pulled ${imported} new events for user ${userId}`);
    return c.json({ success: true, imported, total: events.length }, 200, corsHeaders);
  } catch (err) {
    console.error("[Sync Google] Pull error:", err);
    return c.json({ error: "Internal error" }, 500, corsHeaders);
  }
});

app.options("*", (c) => {
  return new Response(null, { headers: corsHeaders });
});

Deno.serve(app.fetch);
