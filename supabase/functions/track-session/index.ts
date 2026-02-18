import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseUserAgent(ua: string): string {
  if (!ua) return "Desconhecido";

  let browser = "Navegador";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

  let os = "";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  return os ? `${browser} no ${os}` : browser;
}

async function resolveLocation(ip: string): Promise<{ city: string; region: string; country: string }> {
  const fallback = { city: "", region: "", country: "" };
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168") || ip.startsWith("10.")) return fallback;

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country&lang=pt-BR`);
    if (!res.ok) { await res.text(); return fallback; }
    const data = await res.json();
    return { city: data.city || "", region: data.regionName || "", country: data.country || "" };
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get workspace
    const { data: wsData } = await adminClient.rpc("get_user_workspace_id", { _user_id: user.id });
    if (!wsData) {
      return new Response(JSON.stringify({ error: "No workspace" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("cf-connecting-ip") ||
               req.headers.get("x-real-ip") || "";
    const userAgent = req.headers.get("user-agent") || "";
    const deviceLabel = parseUserAgent(userAgent);

    // Resolve location
    const location = await resolveLocation(ip);

    // Upsert session (one per user+device combo)
    const sessionKey = `${user.id}-${deviceLabel}`;
    
    // Check existing active session for this user+device
    const { data: existing } = await adminClient
      .from("user_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("device_label", deviceLabel)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      await adminClient
        .from("user_sessions")
        .update({
          ip_address: ip,
          user_agent: userAgent,
          city: location.city,
          region: location.region,
          country: location.country,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await adminClient
        .from("user_sessions")
        .insert({
          user_id: user.id,
          workspace_id: wsData,
          ip_address: ip,
          user_agent: userAgent,
          device_label: deviceLabel,
          city: location.city,
          region: location.region,
          country: location.country,
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-session error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
