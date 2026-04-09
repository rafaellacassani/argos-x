import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const token = authHeader.replace("Bearer ", "").trim();
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claimsData, error: authErr } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (authErr || !userId) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Get workspace
    const { data: member } = await adminClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .limit(1)
      .single();

    if (!member) throw new Error("No workspace found");
    const wsId = member.workspace_id;

    const { question } = await req.json();
    if (!question || typeof question !== "string") throw new Error("Missing question");

    // Gather workspace context in parallel
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      leadsTotal,
      leadsThisWeek,
      leadsToday,
      recentLeads,
      agents,
      instances,
      unansweredLeads,
      stages,
      campaigns,
      workspace,
    ] = await Promise.all([
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId),
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).gte("created_at", weekAgo),
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).gte("created_at", todayStart),
      adminClient.from("leads").select("id, name, phone, source, created_at, status, stage_id, notes, value").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(20),
      adminClient.from("ai_agents").select("id, name, is_active, type, instance_name, model").eq("workspace_id", wsId),
      adminClient.from("whatsapp_instances").select("instance_name, status, phone_number, connection_type").eq("workspace_id", wsId),
      // Leads with no outgoing message in last 24h (unanswered)
      adminClient.rpc("get_unanswered_leads_count", { p_workspace_id: wsId }).maybeSingle(),
      adminClient.from("funnel_stages").select("id, name, position, color").eq("workspace_id", wsId).order("position"),
      adminClient.from("campaigns").select("id, name, status, sent_count, total_recipients, created_at").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(5),
      adminClient.from("workspaces").select("name, plan, status").eq("id", wsId).single(),
    ]);

    // Get recent messages for search capability
    let recentMessages: any[] = [];
    if (question.toLowerCase().includes("mensagem") || question.toLowerCase().includes("message") || question.toLowerCase().includes("disse") || question.toLowerCase().includes("falou")) {
      const { data } = await adminClient
        .from("messages")
        .select("id, lead_id, content, sender, created_at, lead:leads(name, phone)")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(50);
      recentMessages = data || [];
    }

    // Build stage map
    const stageMap: Record<string, string> = {};
    (stages.data || []).forEach((s: any) => { stageMap[s.id] = s.name; });

    // Enrich leads with stage names
    const enrichedLeads = (recentLeads.data || []).map((l: any) => ({
      ...l,
      stage_name: l.stage_id ? stageMap[l.stage_id] || "desconhecido" : "sem etapa",
    }));

    const contextData = {
      workspace: workspace.data,
      stats: {
        total_leads: leadsTotal.count || 0,
        leads_this_week: leadsThisWeek.count || 0,
        leads_today: leadsToday.count || 0,
      },
      recent_leads: enrichedLeads,
      agents: agents.data || [],
      instances: instances.data || [],
      stages: stages.data || [],
      recent_campaigns: campaigns.data || [],
      recent_messages: recentMessages,
    };

    const systemPrompt = `Você é o **Assistente de Workspace** do Argos X. Seu papel é responder perguntas sobre os dados do workspace do usuário.

DADOS DO WORKSPACE (atualizados agora):
${JSON.stringify(contextData, null, 2)}

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja direto, conciso e útil
- Use os dados fornecidos para responder
- Se não encontrar a informação nos dados, diga que não encontrou mas sugira como o usuário pode encontrar (ex: "verifique na página de Chats")
- Formate números e datas de forma legível
- Use emojis moderadamente para tornar a resposta mais visual
- NÃO invente dados que não estejam no contexto
- Para perguntas sobre mensagens específicas, use os dados de recent_messages
- Quando mencionar leads, inclua nome e telefone quando disponível`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("workspace-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
