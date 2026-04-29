import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXCLUDED_WORKSPACES = [
  "41efdc6d-d4ba-4589-9761-7438a5911d57", // Argos X
  "6a8540c9-3ce9-4ad4-a1d5-1e43c0ee9b8e", // ECX Company
];

const PROMO_MESSAGE = `🟢 *OFERTA RELÂMPAGO — SÓ HOJE 29/04!*

Pague o Argos X por *12 meses com 50% de desconto*:
✅ Essencial — R$287,40/ano
✅ Negócio — R$587,40/ano
✅ Escala — R$1.187,40/ano

Entre agora no sistema — o banner já está te esperando!
🔗 argosx.com.br
⏰ Termina à meia-noite de hoje.`;

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, "");
  if (p.length < 10) return null;
  if (!p.startsWith("55")) p = "55" + p;
  return p;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const ASSISTANT_INSTANCE_NAME = Deno.env.get("ASSISTANT_INSTANCE_NAME") || "iara-mkt-boost";

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Buscar workspaces elegíveis (active + trialing, não bloqueados, fora dos masters)
    const { data: workspaces, error: wsErr } = await supabase
      .from("workspaces")
      .select("id, name, plan_type, subscription_status, blocked_at")
      .is("blocked_at", null)
      .not("id", "in", `(${EXCLUDED_WORKSPACES.join(",")})`);

    if (wsErr) throw wsErr;

    const eligibleWs = (workspaces || []).filter((w: any) => {
      const isActive = w.subscription_status === "active" &&
        ["active", "essencial", "negocio", "escala"].includes(w.plan_type);
      const isTrial = w.subscription_status === "trialing";
      return isActive || isTrial;
    });

    // Buscar admins de cada workspace
    const wsIds = eligibleWs.map((w: any) => w.id);
    const { data: members } = await supabase
      .from("workspace_members")
      .select("workspace_id, user_id")
      .in("workspace_id", wsIds)
      .eq("role", "admin")
      .not("accepted_at", "is", null);

    const userIds = [...new Set((members || []).map((m: any) => m.user_id))];
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, full_name, phone, personal_whatsapp")
      .in("user_id", userIds);

    const profileByUser = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    // Montar lista de destinatários únicos por telefone
    const recipients = new Map<string, { workspace_id: string; user_id: string; name: string; phone: string }>();

    for (const m of members || []) {
      const p: any = profileByUser.get(m.user_id);
      if (!p) continue;
      const phone = normalizePhone(p.phone) || normalizePhone(p.personal_whatsapp);
      if (!phone) continue;
      if (recipients.has(phone)) continue;
      recipients.set(phone, {
        workspace_id: m.workspace_id,
        user_id: m.user_id,
        name: p.full_name || "Cliente",
        phone,
      });
    }

    const list = Array.from(recipients.values());

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true,
        eligible_workspaces: eligibleWs.length,
        unique_recipients: list.length,
        sample: list.slice(0, 5).map((r) => ({ name: r.name, phone: r.phone })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const batchId = `flash_promo_20260429_${Date.now()}`;
    let sent = 0, failed = 0;
    const errors: string[] = [];

    for (const r of list) {
      try {
        const res = await fetch(`${apiUrl}/message/sendText/${ASSISTANT_INSTANCE_NAME}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({ number: r.phone, text: PROMO_MESSAGE }),
        });
        if (res.ok) sent++; else {
          failed++;
          errors.push(`${r.phone}: HTTP ${res.status}`);
        }
      } catch (e: any) {
        failed++;
        errors.push(`${r.phone}: ${e.message}`);
      }
      // Rate limit: 4s entre envios para reduzir risco de ban
      await new Promise((res) => setTimeout(res, 4000));
    }

    return new Response(JSON.stringify({
      success: true,
      batch_id: batchId,
      total_recipients: list.length,
      sent,
      failed,
      errors: errors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("send-flash-promo-blast error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});