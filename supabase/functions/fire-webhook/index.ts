import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fire webhook events for deal.stage_changed (called by DB trigger or internal services)
// Also supports manual test calls from the frontend

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function deliverWebhook(
  supabase: any,
  webhook: { id: string; url: string; secret_hash: string },
  payload: unknown,
  workspaceId: string,
  attempt = 1
): Promise<{ success: boolean; status_code?: number; attempts: number }> {
  const maxAttempts = 5;
  const payloadStr = JSON.stringify(payload);
  const payloadId = crypto.randomUUID();

  const encoder = new TextEncoder();
  const keyData = encoder.encode(webhook.secret_hash);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadStr));
  const signature = "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const timestamp = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Argos-Signature": signature,
        "X-Argos-Event": (payload as any).event || "unknown",
        "X-Argos-Timestamp": timestamp,
        "X-Argos-Delivery-Id": payloadId,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseBody = await response.text();

    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      workspace_id: workspaceId,
      event_type: (payload as any).event,
      payload,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      attempt,
      delivered_at: response.ok ? new Date().toISOString() : null,
      status: response.ok ? "delivered" : "failed",
      payload_id: payloadId,
    });

    console.log(`[fire-webhook] Delivery ${webhook.id}: status=${response.status}, attempt=${attempt}`);

    if (!response.ok && attempt < maxAttempts) {
      const backoffMs = [1000, 5000, 30000, 120000, 300000][attempt - 1] || 300000;
      await new Promise((r) => setTimeout(r, backoffMs));
      return deliverWebhook(supabase, webhook, payload, workspaceId, attempt + 1);
    }

    return { success: response.ok, status_code: response.status, attempts: attempt };
  } catch (err) {
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      workspace_id: workspaceId,
      event_type: (payload as any).event,
      payload,
      response_status: 0,
      response_body: (err as Error).message,
      attempt,
      status: "failed",
      payload_id: payloadId,
    });

    console.error(`[fire-webhook] Delivery error for ${webhook.id}: ${(err as Error).message}`);

    if (attempt < maxAttempts) {
      const backoffMs = [1000, 5000, 30000, 120000, 300000][attempt - 1] || 300000;
      await new Promise((r) => setTimeout(r, backoffMs));
      return deliverWebhook(supabase, webhook, payload, workspaceId, attempt + 1);
    }

    return { success: false, attempts: attempt };
  }
}

async function fireWebhookEvent(supabase: any, workspaceId: string, eventType: string, data: unknown) {
  try {
    const { data: webhooks } = await supabase
      .from("webhooks")
      .select("id, url, secret_hash, events")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if (!webhooks || webhooks.length === 0) {
      console.log(`[fire-webhook] No active webhooks for workspace ${workspaceId}`);
      return;
    }

    const payload = {
      event: eventType,
      data,
      occurred_at: new Date().toISOString(),
      event_id: crypto.randomUUID(),
    };

    for (const wh of webhooks) {
      if (!wh.events || !Array.isArray(wh.events) || !wh.events.includes(eventType)) continue;

      console.log(`[fire-webhook] Delivering ${eventType} to ${wh.url}`);
      deliverWebhook(supabase, wh, payload, workspaceId).catch((err) => {
        console.error(`[fire-webhook] Delivery failed for ${wh.id}:`, err);
      });
    }
  } catch (err) {
    console.error("[fire-webhook] fireWebhookEvent error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate: either service role (from DB trigger) or user JWT
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(serviceRoleKey);

    if (!isServiceRole) {
      // Check user JWT
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { event_type, workspace_id, data } = body;

    if (!event_type || !workspace_id) {
      return new Response(JSON.stringify({ error: "event_type and workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[fire-webhook] Processing ${event_type} for workspace ${workspace_id}`);

    await fireWebhookEvent(supabase, workspace_id, event_type, data);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fire-webhook] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
