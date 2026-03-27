import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, workspaceId } = await req.json();
    if (!leadId || !workspaceId) {
      return new Response(JSON.stringify({ error: "leadId and workspaceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch lead data
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("workspace_id", workspaceId)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch message count and recency
    const { count: msgCount } = await supabase
      .from("whatsapp_messages")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("remote_jid", lead.whatsapp_jid || "none");

    // Fetch recent messages for content analysis
    const { data: recentMsgs } = await supabase
      .from("whatsapp_messages")
      .select("content, from_me, timestamp")
      .eq("workspace_id", workspaceId)
      .eq("remote_jid", lead.whatsapp_jid || "none")
      .order("timestamp", { ascending: false })
      .limit(20);

    // Fetch lead history (stage changes)
    const { count: stageChanges } = await supabase
      .from("lead_history")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("action", "stage_change");

    // Fetch sales
    const { data: sales } = await supabase
      .from("lead_sales")
      .select("value")
      .eq("lead_id", leadId);

    const totalSales = (sales || []).reduce((sum, s) => sum + Number(s.value || 0), 0);

    // Build context for AI
    const messagesPreview = (recentMsgs || [])
      .reverse()
      .map((m) => `${m.from_me ? "Agente" : "Cliente"}: ${(m.content || "").substring(0, 100)}`)
      .join("\n");

    const now = new Date();
    const createdAt = new Date(lead.created_at);
    const updatedAt = new Date(lead.updated_at);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
    const hoursSinceLastUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / 3600000);

    const prompt = `Você é um especialista em classificação de leads de vendas. Analise os dados abaixo e dê uma nota de 0 a 100 para este lead, onde:
- 0-29 = Frio (sem interesse, sem engajamento)
- 30-69 = Morno (algum interesse, precisa de nutrição)
- 70-100 = Quente (alto interesse, pronto para comprar)

Dados do lead:
- Nome: ${lead.name}
- Empresa: ${lead.company || "N/A"}
- Fonte: ${lead.source}
- Criado há: ${daysSinceCreation} dias
- Última atividade: ${hoursSinceLastUpdate}h atrás
- Total de mensagens: ${msgCount || 0}
- Mudanças de etapa no funil: ${stageChanges || 0}
- Valor em vendas: R$ ${totalSales.toFixed(2)}
- Valor do lead: R$ ${Number(lead.value || 0).toFixed(2)}

Últimas mensagens:
${messagesPreview || "(sem mensagens)"}

Responda APENAS com um JSON no formato: {"score": <numero>, "label": "<quente|morno|frio>", "reason": "<motivo em 1 frase>"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um classificador de leads. Responda apenas com JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[score-lead] AI error:", errText);
      return new Response(JSON.stringify({ error: "AI scoring failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[score-lead] Could not parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scoring = JSON.parse(jsonMatch[0]);
    const score = Math.min(100, Math.max(0, Math.round(Number(scoring.score))));
    let label = "frio";
    if (score >= 70) label = "quente";
    else if (score >= 30) label = "morno";

    // Update lead
    const { error: updateErr } = await supabase
      .from("leads")
      .update({
        ai_score: score,
        ai_score_label: label,
        ai_scored_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateErr) {
      console.error("[score-lead] Update error:", updateErr);
    }

    return new Response(
      JSON.stringify({ score, label, reason: scoring.reason || "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[score-lead] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
