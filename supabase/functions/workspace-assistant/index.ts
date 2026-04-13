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

    const q = question.toLowerCase();

    // Gather workspace context in parallel — ALWAYS fetch comprehensive data
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const hours24Ago = new Date(now.getTime() - 24 * 3600000).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const week7 = new Date(now.getTime() + 7 * 86400000).toISOString();

    const [
      leadsTotal,
      leadsThisWeek,
      leadsToday,
      recentLeads,
      agents,
      instances,
      stages,
      campaigns,
      workspace,
      members,
      tags,
      recentMessages,
      humanQueue,
      agentExecs,
      calendarToday,
      calendarUpcoming,
      followupCampaigns,
      agentFollowupsPending,
      agentFollowupsSent,
    ] = await Promise.all([
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId),
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).gte("created_at", weekAgo),
      adminClient.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).gte("created_at", todayStart),
      adminClient.from("leads").select("id, name, phone, source, created_at, status, stage_id, notes, value, responsible_user, is_opted_out, ai_score_label").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(50),
      adminClient.from("ai_agents").select("id, name, is_active, type, instance_name, model, followup_enabled").eq("workspace_id", wsId),
      adminClient.from("whatsapp_instances").select("instance_name, status, phone_number, connection_type").eq("workspace_id", wsId),
      adminClient.from("funnel_stages").select("id, name, position, color, is_win_stage, is_loss_stage").eq("workspace_id", wsId).order("position"),
      adminClient.from("campaigns").select("id, name, status, sent_count, total_recipients, created_at, failed_count, delivered_count").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(10),
      adminClient.from("workspaces").select("name, plan, status, lead_limit, extra_leads, whatsapp_limit, user_limit, subscription_status").eq("id", wsId).single(),
      adminClient.from("workspace_members").select("user_id, role, accepted_at, user_profile:user_profiles(full_name, email)").eq("workspace_id", wsId),
      adminClient.from("lead_tags").select("id, name, color").eq("workspace_id", wsId),
      adminClient.from("messages").select("id, lead_id, content, sender, created_at, lead:leads(name, phone)").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(200),
      adminClient.from("human_support_queue").select("id, lead_id, reason, status, created_at, lead:leads(name, phone)").eq("workspace_id", wsId).eq("status", "pending").order("created_at", { ascending: false }).limit(20),
      // NEW: Agent executions last 24h
      adminClient.from("agent_executions").select("agent_id, status, tokens_used, latency_ms, error_message").eq("workspace_id", wsId).gte("executed_at", hours24Ago),
      // NEW: Calendar events today
      adminClient.from("calendar_events").select("title, start_at, end_at, type, lead_id, lead:leads(name)").eq("workspace_id", wsId).gte("start_at", todayStart).lt("start_at", todayEnd).order("start_at"),
      // NEW: Calendar events next 7 days (excluding today)
      adminClient.from("calendar_events").select("title, start_at, type").eq("workspace_id", wsId).gte("start_at", todayEnd).lt("start_at", week7).order("start_at").limit(20),
      // NEW: Followup campaigns recent
      adminClient.from("followup_campaigns").select("id, status, total_contacts, sent_count, skipped_count, failed_count, created_at, agent:ai_agents(name)").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(10),
      // NEW: Agent followup queue pending
      adminClient.from("agent_followup_queue").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("status", "pending"),
      // NEW: Agent followup queue sent last 24h
      adminClient.from("agent_followup_queue").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("status", "sent").gte("executed_at", hours24Ago),
    ]);

    // Build stage map
    const stageMap: Record<string, string> = {};
    (stages.data || []).forEach((s: any) => { stageMap[s.id] = s.name; });

    // Enrich leads with stage names
    const enrichedLeads = (recentLeads.data || []).map((l: any) => ({
      ...l,
      stage_name: l.stage_id ? stageMap[l.stage_id] || "desconhecido" : "sem etapa",
    }));

    // Compute unanswered leads: leads where the LAST message is from the lead (not from us)
    const messagesByLead: Record<string, any[]> = {};
    (recentMessages.data || []).forEach((m: any) => {
      if (!messagesByLead[m.lead_id]) messagesByLead[m.lead_id] = [];
      messagesByLead[m.lead_id].push(m);
    });

    const unansweredLeads: any[] = [];
    for (const [leadId, msgs] of Object.entries(messagesByLead)) {
      // Messages are ordered desc by created_at, so first = most recent
      const lastMsg = msgs[0];
      if (lastMsg && lastMsg.sender === "lead") {
        unansweredLeads.push({
          lead_id: leadId,
          lead_name: lastMsg.lead?.name || "Desconhecido",
          lead_phone: lastMsg.lead?.phone || "",
          last_message: lastMsg.content?.substring(0, 100) || "",
          last_message_at: lastMsg.created_at,
        });
      }
    }

    // Leads by stage distribution
    const leadsByStage: Record<string, number> = {};
    enrichedLeads.forEach((l: any) => {
      const stage = l.stage_name || "sem etapa";
      leadsByStage[stage] = (leadsByStage[stage] || 0) + 1;
    });

    // Leads by source distribution
    const leadsBySource: Record<string, number> = {};
    enrichedLeads.forEach((l: any) => {
      const source = l.source || "desconhecido";
      leadsBySource[source] = (leadsBySource[source] || 0) + 1;
    });

    const contextData = {
      workspace: workspace.data,
      stats: {
        total_leads: leadsTotal.count || 0,
        leads_this_week: leadsThisWeek.count || 0,
        leads_today: leadsToday.count || 0,
        unanswered_count: unansweredLeads.length,
        pending_human_support: (humanQueue.data || []).length,
      },
      unanswered_leads: unansweredLeads.slice(0, 20),
      leads_by_stage: leadsByStage,
      leads_by_source: leadsBySource,
      recent_leads: enrichedLeads.slice(0, 30),
      agents: agents.data || [],
      instances: instances.data || [],
      stages: stages.data || [],
      recent_campaigns: campaigns.data || [],
      recent_messages: (recentMessages.data || []).slice(0, 100).map((m: any) => ({
        lead_name: m.lead?.name || "?",
        lead_phone: m.lead?.phone || "",
        content: m.content?.substring(0, 150) || "",
        sender: m.sender,
        created_at: m.created_at,
      })),
      team_members: (members.data || []).map((m: any) => ({
        name: m.user_profile?.full_name || "?",
        email: m.user_profile?.email || "",
        role: m.role,
      })),
      tags: tags.data || [],
      human_support_queue: (humanQueue.data || []).map((h: any) => ({
        lead_name: h.lead?.name || "?",
        lead_phone: h.lead?.phone || "",
        reason: h.reason,
        created_at: h.created_at,
      })),
    };

    const systemPrompt = `Você é o **Assistente de Workspace** do Argos X — um CRM com WhatsApp, IA e funil de vendas.
Seu papel é responder QUALQUER pergunta sobre os dados do workspace do usuário com precisão.

DADOS DO WORKSPACE (atualizados agora, ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}):
${JSON.stringify(contextData, null, 2)}

CAPACIDADES:
- Você tem acesso a leads, mensagens recentes, agentes de IA, campanhas, membros da equipe, tags, fila de suporte humano e distribuição por etapa/fonte
- "unanswered_leads" = leads cuja ÚLTIMA mensagem foi enviada PELO LEAD (sem resposta nossa ainda)
- "human_support_queue" = leads aguardando atendimento humano
- "recent_messages" = últimas mensagens trocadas no workspace, com nome do lead e conteúdo

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja direto, conciso e útil — vá direto ao ponto
- Use os dados fornecidos para responder com precisão
- Se perguntarem "esqueci de responder alguém" ou "tem alguém sem resposta", use a lista "unanswered_leads" — mostre nome, telefone e prévia da última mensagem
- Se perguntarem sobre uma pessoa específica, busque pelo nome nas mensagens e leads
- Se perguntarem sobre um lead, mostre: nome, telefone, etapa, origem, valor, data de criação
- Formate números e datas de forma legível (ex: "terça-feira às 14:30")
- Use emojis moderadamente para tornar a resposta mais visual
- NÃO invente dados que não estejam no contexto
- Quando mencionar leads, SEMPRE inclua nome e telefone
- Se não encontrar a informação nos dados disponíveis, diga claramente e sugira onde o usuário pode verificar (ex: "acesse a aba de Chats para ver conversas mais antigas")`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
