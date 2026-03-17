import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

type PermissionLevel = "denied" | "read" | "write";

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getRequiredPermission(method: string): PermissionLevel {
  if (method === "GET") return "read";
  return "write";
}

function extractResource(pathname: string): string | null {
  // /api-gateway/v1/{resource}/...
  const parts = pathname.split("/").filter(Boolean);
  const v1Index = parts.indexOf("v1");
  if (v1Index >= 0 && parts[v1Index + 1]) {
    return parts[v1Index + 1];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");

  if (!apiKey || !apiKey.startsWith("argx_")) {
    return new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const keyHash = await hashKey(apiKey);

    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("id, workspace_id, permissions, is_active, expires_at")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyRecord) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!keyRecord.is_active) {
      return new Response(JSON.stringify({ error: "API key is disabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "API key expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id);

    const url = new URL(req.url);
    const resource = extractResource(url.pathname);

    if (!resource) {
      // Return available resources documentation
      const docs = {
        version: "v1",
        base_url: `${supabaseUrl}/functions/v1/api-gateway/v1`,
        resources: {
          leads: { read: "GET /leads", write: "POST /leads, PATCH /leads/:id" },
          contacts: { read: "GET /contacts" },
          messages: { read: "GET /messages", write: "POST /messages" },
          agents: { read: "GET /agents", write: "POST /agents/execute" },
          campaigns: { read: "GET /campaigns" },
          calendar: { read: "GET /calendar", write: "POST /calendar" },
          tags: { read: "GET /tags", write: "POST /tags" },
          funnels: { read: "GET /funnels" },
          webhooks: { read: "GET /webhooks", write: "POST /webhooks" },
        },
      };
      return new Response(JSON.stringify(docs), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const permissions = keyRecord.permissions as Record<string, PermissionLevel>;
    const resourcePermission = permissions[resource] || "denied";
    const requiredPermission = getRequiredPermission(req.method);

    const hasPermission =
      resourcePermission === "write" ||
      (resourcePermission === "read" && requiredPermission === "read");

    // Log usage
    const statusCode = hasPermission ? 200 : 403;
    await supabase.from("api_key_usage_log").insert({
      api_key_id: keyRecord.id,
      workspace_id: keyRecord.workspace_id,
      endpoint: `/${resource}`,
      method: req.method,
      status_code: statusCode,
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({
          error: "Insufficient permissions",
          resource,
          required: requiredPermission,
          current: resourcePermission,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workspaceId = keyRecord.workspace_id;
    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = {}; }
    }

    // Route to resource handlers
    let result: unknown;

    switch (resource) {
      case "leads": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("leads")
            .select("id, name, phone, email, company, source, stage_id, responsible_user, value, status, created_at, updated_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(100);
          result = data;
        } else if (req.method === "POST") {
          const { data, error } = await supabase
            .from("leads")
            .insert({ ...body, workspace_id: workspaceId })
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else if (req.method === "PATCH") {
          const leadId = url.pathname.split("/").pop();
          const { data, error } = await supabase
            .from("leads")
            .update(body)
            .eq("id", leadId)
            .eq("workspace_id", workspaceId)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }
      case "tags": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("lead_tags")
            .select("id, name, color, created_at")
            .eq("workspace_id", workspaceId);
          result = data;
        } else if (req.method === "POST") {
          const { data, error } = await supabase
            .from("lead_tags")
            .insert({ ...body, workspace_id: workspaceId })
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }
      case "funnels": {
        const { data } = await supabase
          .from("funnels")
          .select("id, name, description, funnel_stages(id, name, color, position)")
          .eq("workspace_id", workspaceId);
        result = data;
        break;
      }
      case "agents": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("ai_agents")
            .select("id, name, description, type, model, is_active, created_at")
            .eq("workspace_id", workspaceId);
          result = data;
        }
        break;
      }
      case "campaigns": {
        const { data } = await supabase
          .from("campaigns")
          .select("id, name, status, total_recipients, sent_count, delivered_count, failed_count, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "calendar": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("calendar_events")
            .select("id, title, description, start_at, end_at, type, color, location")
            .eq("workspace_id", workspaceId)
            .order("start_at", { ascending: false })
            .limit(100);
          result = data;
        } else if (req.method === "POST") {
          const { data, error } = await supabase
            .from("calendar_events")
            .insert({ ...body, workspace_id: workspaceId })
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }
      case "messages": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("whatsapp_messages")
            .select("id, remote_jid, direction, content, message_type, timestamp, from_me, push_name")
            .eq("workspace_id", workspaceId)
            .order("timestamp", { ascending: false })
            .limit(100);
          result = data;
        }
        break;
      }
      case "contacts": {
        const { data } = await supabase
          .from("leads")
          .select("id, name, phone, email, company, created_at")
          .eq("workspace_id", workspaceId)
          .order("name");
        result = data;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown resource: ${resource}` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-gateway error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
