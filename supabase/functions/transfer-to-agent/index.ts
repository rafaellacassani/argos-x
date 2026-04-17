import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
    const rawEvolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    const evolutionApiUrl = rawEvolutionUrl.replace(/\/manager\/?$/, "");

    // Auth check — accept service-role token (internal calls from ai-agent-chat) or user JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;
    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { lead_id, source_agent_id, reason, triggered_by } = body;
    let { target_agent_id, target_department_name } = body;

    if (!lead_id || (!target_agent_id && !target_department_name)) {
      return new Response(JSON.stringify({ error: "lead_id and (target_agent_id or target_department_name) are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Get lead info
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, phone, whatsapp_jid, instance_name, source, workspace_id, active_agent_id")
      .eq("id", lead_id)
      .single();
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1b. Resolve target agent by department name if needed
    if (!target_agent_id && target_department_name) {
      const { data: deptAgents } = await supabase
        .from("ai_agents")
        .select("id, ai_departments!inner(name, workspace_id)")
        .eq("ai_departments.workspace_id", lead.workspace_id)
        .ilike("ai_departments.name", target_department_name)
        .eq("is_active", true)
        .limit(1);
      if (deptAgents && deptAgents.length > 0) {
        target_agent_id = deptAgents[0].id;
      } else {
        return new Response(JSON.stringify({ error: `No active agent found in department "${target_department_name}"` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 2. Get target agent
    const { data: targetAgent, error: taErr } = await supabase
      .from("ai_agents")
      .select("id, name, system_prompt, model, temperature, max_tokens, instance_name, workspace_id, message_split_enabled, message_split_length, knowledge_products, knowledge_faq, knowledge_rules, knowledge_extra, main_objective, tone_of_voice, agent_role, use_emojis, response_length, company_info, department_id")
      .eq("id", target_agent_id)
      .single();
    if (taErr || !targetAgent) {
      return new Response(JSON.stringify({ error: "Target agent not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2b. Anti-loop: check transfer count in source memory
    if (source_agent_id) {
      const { data: srcMem } = await supabase
        .from("agent_memories")
        .select("id, transfer_count, last_transfer_at")
        .eq("agent_id", source_agent_id)
        .eq("lead_id", lead_id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (srcMem && srcMem.length > 0) {
        const m = srcMem[0];
        const recentWindow = m.last_transfer_at && (Date.now() - new Date(m.last_transfer_at).getTime() < 10 * 60 * 1000);
        if (recentWindow && (m.transfer_count || 0) >= 3) {
          // Too many transfers — escalate to human instead
          await supabase.from("human_support_queue").insert({
            workspace_id: lead.workspace_id,
            lead_id: lead.id,
            reason: "transfer_loop_detected",
            priority: "high",
            status: "pending",
            metadata: { transfer_count: m.transfer_count, source_agent_id, attempted_target: target_agent_id },
          });
          // Pause source agent
          await supabase.from("agent_memories").update({ is_paused: true }).eq("id", m.id);
          return new Response(JSON.stringify({
            success: false,
            escalated_to_human: true,
            message: "Loop de transferência detectado. Atendimento escalado para humano.",
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // 3. Get source agent info (optional, for context)
    let sourceAgentName = "outro atendente";
    let conversationSummary = "";

    if (source_agent_id) {
      const { data: sourceAgent } = await supabase
        .from("ai_agents")
        .select("id, name")
        .eq("id", source_agent_id)
        .single();
      if (sourceAgent) sourceAgentName = sourceAgent.name;

      // Get source agent's memory for this lead to build context
      const { data: memories } = await supabase
        .from("agent_memories")
        .select("messages, session_id")
        .eq("agent_id", source_agent_id)
        .eq("lead_id", lead_id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (memories && memories.length > 0) {
        const msgs = memories[0].messages as any[];
        // Extract last 10 messages for context summary
        const recentMsgs = (Array.isArray(msgs) ? msgs : []).slice(-10);
        conversationSummary = recentMsgs
          .filter((m: any) => m.role !== "system")
          .map((m: any) => `${m.role === "user" ? "Lead" : sourceAgentName}: ${(m.content || "").substring(0, 200)}`)
          .join("\n");

        // 4. Pause source agent's session for this lead
        await supabase
          .from("agent_memories")
          .update({ is_paused: true })
          .eq("agent_id", source_agent_id)
          .eq("lead_id", lead_id);

        // Cancel pending follow-ups from source agent
        await supabase
          .from("agent_followup_queue")
          .update({ status: "canceled", canceled_reason: "transferred_to_agent" })
          .eq("agent_id", source_agent_id)
          .eq("lead_id", lead_id)
          .eq("status", "pending");

        console.log(`[transfer-to-agent] ⏸️ Paused source agent ${source_agent_id} for lead ${lead_id}`);
      }
    }

    // 5. Generate contextual first message using AI
    const apiKey = openaiApiKey || lovableApiKey;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No AI API key configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiUrl = openaiApiKey
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = openaiApiKey ? "gpt-4o-mini" : "openai/gpt-5-nano";

    const leadName = lead.name || "cliente";
    const contextPrompt = `Você é ${targetAgent.name}, ${targetAgent.agent_role || "atendente virtual"}.
${targetAgent.tone_of_voice ? `Tom de voz: ${targetAgent.tone_of_voice}` : ""}
${targetAgent.use_emojis ? "Use emojis com moderação." : "Não use emojis."}

Você está recebendo uma transferência de atendimento. O lead "${leadName}" estava sendo atendido por "${sourceAgentName}" e foi transferido para você.

${conversationSummary ? `Aqui está o resumo da conversa anterior:\n\n${conversationSummary}` : "Não há histórico de conversa disponível."}

Gere UMA ÚNICA mensagem de apresentação curta e natural para o lead, mencionando:
1. Seu nome (${targetAgent.name})
2. Que ${sourceAgentName} enviou o contato
3. Um resumo breve do que o lead precisa (baseado no histórico)
4. Que você está pronta para ajudar

IMPORTANTE: Seja breve (2-3 frases). Não invente informações. Se não houver contexto claro, apenas se apresente e pergunte como pode ajudar.
Responda APENAS com a mensagem, sem aspas ou prefixos.`;

    const aiRes = await fetch(aiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [{ role: "user", content: contextPrompt }],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    let introMessage = `Olá ${leadName}! Sou ${targetAgent.name}, ${sourceAgentName} me passou seu contato. Como posso te ajudar?`;

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const generated = aiData.choices?.[0]?.message?.content?.trim();
      if (generated) introMessage = generated;
    } else {
      console.warn(`[transfer-to-agent] ⚠️ AI generation failed, using fallback message`);
    }

    // 6. Determine channel and send the message
    const isWaba = lead.source === "meta_facebook" || lead.source === "meta_instagram" || lead.source === "meta_whatsapp" || lead.source === "whatsapp_cloud";
    let messageSent = false;

    if (isWaba) {
      // Send via WhatsApp Cloud API (meta-send-message)
      const { data: metaPages } = await supabase
        .from("meta_pages")
        .select("id, page_id, access_token")
        .eq("workspace_id", lead.workspace_id)
        .eq("platform", "whatsapp_business")
        .eq("is_active", true)
        .limit(1);

      if (metaPages && metaPages.length > 0) {
        const page = metaPages[0];
        const phone = (lead.phone || "").replace(/\D/g, "");
        const res = await fetch(`https://graph.facebook.com/v21.0/${page.page_id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${page.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: "text",
            text: { body: introMessage },
          }),
        });
        messageSent = res.ok;
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[transfer-to-agent] ❌ WABA send failed: ${errText}`);
        }

        // Save outbound message
        if (messageSent) {
          await supabase.from("meta_conversations").insert({
            meta_page_id: page.id,
            platform: "whatsapp_business",
            sender_id: phone,
            message_id: `transfer-${Date.now()}`,
            content: introMessage,
            message_type: "text",
            direction: "outbound",
            timestamp: new Date().toISOString(),
            raw_payload: { source: "agent_transfer" },
            workspace_id: lead.workspace_id,
          });
        }
      }
    } else {
      // Send via Evolution API
      const instanceName = lead.instance_name || targetAgent.instance_name;
      if (instanceName && evolutionApiKey && evolutionApiUrl) {
        const number = (lead.whatsapp_jid || lead.phone || "").replace(/@s\.whatsapp\.net$|@lid$|@c\.us$/i, "");
        if (number) {
          const res = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
            body: JSON.stringify({ number, text: introMessage, delay: 0, linkPreview: false }),
          });
          messageSent = res.ok;
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[transfer-to-agent] ❌ Evolution send failed: ${errText}`);
          }
        }
      }
    }

    // 7. Create/update memory for target agent with this lead
    const sessionId = isWaba
      ? `waba_${(lead.phone || "").replace(/\D/g, "")}`
      : (lead.whatsapp_jid || lead.phone || "").replace(/@s\.whatsapp\.net$|@lid$|@c\.us$/i, "");

    // Check if there's already a memory for this target agent + session
    const { data: existingMemory } = await supabase
      .from("agent_memories")
      .select("id")
      .eq("agent_id", target_agent_id)
      .eq("session_id", sessionId)
      .limit(1);

    const transferContext: any[] = [
      {
        role: "system",
        content: `[CONTEXTO DE TRANSFERÊNCIA] Este lead foi transferido de ${sourceAgentName}. Resumo da conversa anterior:\n${conversationSummary || "Sem histórico disponível."}`,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: introMessage,
        timestamp: new Date().toISOString(),
      },
    ];

    if (existingMemory && existingMemory.length > 0) {
      await supabase
        .from("agent_memories")
        .update({
          is_paused: false,
          is_processing: false,
          processing_started_at: null,
          lead_id: lead_id,
          messages: transferContext,
        })
        .eq("id", existingMemory[0].id);
    } else {
      await supabase.from("agent_memories").insert({
        agent_id: target_agent_id,
        session_id: sessionId,
        workspace_id: lead.workspace_id,
        lead_id: lead_id,
        messages: transferContext,
        is_paused: false,
        is_processing: false,
      });
    }

    // 8. Atomic lock: claim active_agent_id on lead + bump transfer_count + log
    await supabase.rpc("claim_lead_agent", {
      _lead_id: lead_id,
      _agent_id: target_agent_id,
      _department_id: targetAgent.department_id || null,
    });

    if (source_agent_id) {
      // Bump transfer_count on source memory (we already paused above)
      await supabase.rpc as any; // noop, just to keep sequence
      const { data: srcMem2 } = await supabase
        .from("agent_memories")
        .select("id, transfer_count")
        .eq("agent_id", source_agent_id)
        .eq("lead_id", lead_id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (srcMem2 && srcMem2.length > 0) {
        await supabase
          .from("agent_memories")
          .update({
            transfer_count: ((srcMem2[0] as any).transfer_count || 0) + 1,
            last_transfer_at: new Date().toISOString(),
          })
          .eq("id", srcMem2[0].id);
      }
    }

    // Log transfer
    let sourceDeptId: string | null = null;
    if (source_agent_id) {
      const { data: srcAgent } = await supabase
        .from("ai_agents").select("department_id").eq("id", source_agent_id).single();
      sourceDeptId = (srcAgent as any)?.department_id || null;
    }
    await supabase.from("department_transfers").insert({
      workspace_id: lead.workspace_id,
      lead_id,
      from_agent_id: source_agent_id || null,
      to_agent_id: target_agent_id,
      from_department_id: sourceDeptId,
      to_department_id: targetAgent.department_id || null,
      reason: reason || null,
      triggered_by: triggered_by || (isServiceRole ? "ai_auto" : "human"),
    });

    console.log(`[transfer-to-agent] ✅ Transfer complete: ${sourceAgentName} → ${targetAgent.name} for lead ${leadName} (sent: ${messageSent})`);

    return new Response(JSON.stringify({
      success: true,
      message_sent: messageSent,
      intro_message: introMessage,
      target_agent: targetAgent.name,
      target_agent_id,
      source_agent: sourceAgentName,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[transfer-to-agent] ❌ Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
