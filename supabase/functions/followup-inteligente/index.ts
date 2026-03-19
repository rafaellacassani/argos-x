import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
const rawEvolutionApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const evolutionApiUrl = rawEvolutionApiUrl.replace(/\/manager\/?$/, "");
const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action } = body;

    // ========================
    // ACTION: scan - Find unanswered contacts
    // ========================
    if (action === "scan") {
      const { instance_type, instance_name, meta_page_id, workspace_id } = body;

      if (!workspace_id) {
        return new Response(JSON.stringify({ error: "workspace_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let contacts: { phone: string; name: string | null; sender_id?: string; last_message: string }[] = [];

      if (instance_type === "waba" && meta_page_id) {
        // WABA: scan meta_conversations for contacts whose last message is outbound
        const { data: conversations, error: convError } = await supabase
          .from("meta_conversations")
          .select("sender_id, sender_name, content, direction, timestamp")
          .eq("meta_page_id", meta_page_id)
          .eq("workspace_id", workspace_id)
          .order("timestamp", { ascending: false });

        if (convError) throw convError;

        // Group by sender_id, find those whose last message is outbound (no inbound reply)
        const senderMap = new Map<string, { name: string | null; lastDirection: string; lastContent: string; lastTimestamp: string }>();
        for (const msg of conversations || []) {
          if (!senderMap.has(msg.sender_id)) {
            senderMap.set(msg.sender_id, {
              name: msg.sender_name,
              lastDirection: msg.direction,
              lastContent: msg.content || "",
              lastTimestamp: msg.timestamp,
            });
          }
        }

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        for (const [senderId, info] of senderMap) {
          // Only contacts whose last message was outbound (no reply)
          if (info.lastDirection === "outbound") {
            // Skip if they replied in last 24h
            const hasRecentInbound = (conversations || []).some(
              (m) => m.sender_id === senderId && m.direction === "inbound" && m.timestamp > twentyFourHoursAgo
            );
            if (hasRecentInbound) continue;

            contacts.push({
              phone: senderId,
              name: info.name,
              sender_id: senderId,
              last_message: info.lastContent?.substring(0, 200) || "",
            });
          }
        }
      } else if (instance_type === "evolution" && instance_name) {
        // Evolution: scan whatsapp_messages for contacts whose last message is outbound
        const { data: messages, error: msgError } = await supabase
          .from("whatsapp_messages")
          .select("remote_jid, push_name, content, direction, timestamp")
          .eq("instance_name", instance_name)
          .eq("workspace_id", workspace_id)
          .order("timestamp", { ascending: false });

        if (msgError) throw msgError;

        const jidMap = new Map<string, { name: string | null; lastDirection: string; lastContent: string; lastTimestamp: string }>();
        for (const msg of messages || []) {
          if (msg.remote_jid?.endsWith("@g.us")) continue; // Skip groups
          if (!jidMap.has(msg.remote_jid)) {
            jidMap.set(msg.remote_jid, {
              name: msg.push_name,
              lastDirection: msg.direction,
              lastContent: msg.content || "",
              lastTimestamp: msg.timestamp,
            });
          }
        }

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        for (const [jid, info] of jidMap) {
          if (info.lastDirection === "outbound" || info.lastDirection === "sent") {
            const hasRecentInbound = (messages || []).some(
              (m) => m.remote_jid === jid && (m.direction === "inbound" || m.direction === "received") && m.timestamp > twentyFourHoursAgo
            );
            if (hasRecentInbound) continue;

            const phone = jid.replace(/@s\.whatsapp\.net$/, "");
            contacts.push({
              phone,
              name: info.name,
              sender_id: jid,
              last_message: info.lastContent?.substring(0, 200) || "",
            });
          }
        }
      } else {
        return new Response(JSON.stringify({ error: "Invalid instance configuration" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ contacts, total: contacts.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================
    // ACTION: generate - Generate personalized message for a single contact
    // ========================
    if (action === "generate") {
      const { agent_id, context_prompt, contact_phone, sender_id, instance_type, instance_name, meta_page_id, workspace_id } = body;

      if (!agent_id || !context_prompt || !contact_phone || !workspace_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch agent
      const { data: agent, error: agentError } = await supabase
        .from("ai_agents").select("*").eq("id", agent_id).single();
      if (agentError || !agent) {
        return new Response(JSON.stringify({ error: "Agent not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch conversation history
      let history: { role: string; content: string; timestamp: string }[] = [];

      if (instance_type === "waba" && meta_page_id) {
        const { data: msgs } = await supabase
          .from("meta_conversations")
          .select("content, direction, timestamp")
          .eq("meta_page_id", meta_page_id)
          .eq("sender_id", sender_id || contact_phone)
          .eq("workspace_id", workspace_id)
          .order("timestamp", { ascending: true })
          .limit(50);

        history = (msgs || []).map((m) => ({
          role: m.direction === "inbound" ? "user" : "assistant",
          content: m.content || "",
          timestamp: m.timestamp,
        }));
      } else if (instance_type === "evolution") {
        const jid = contact_phone.includes("@") ? contact_phone : `${contact_phone}@s.whatsapp.net`;
        const { data: msgs } = await supabase
          .from("whatsapp_messages")
          .select("content, direction, timestamp")
          .eq("instance_name", instance_name)
          .eq("remote_jid", jid)
          .eq("workspace_id", workspace_id)
          .order("timestamp", { ascending: true })
          .limit(50);

        history = (msgs || []).map((m) => ({
          role: (m.direction === "inbound" || m.direction === "received") ? "user" : "assistant",
          content: m.content || "",
          timestamp: m.timestamp,
        }));
      }

      // Build the AI prompt
      const agentName = agent.name || "Assistente";
      const companyInfo = agent.company_info as Record<string, string> | null;
      const companyName = companyInfo?.name || companyInfo?.company_name || "";

      const systemPrompt = `Você é ${agentName}${companyName ? ` da ${companyName}` : ""}. Você está fazendo follow-up com um contato via WhatsApp.

CONTEXTO E OBJETIVO DO FOLLOW-UP:
${context_prompt}

INSTRUÇÕES CRÍTICAS:
1. Leia o histórico completo da conversa antes de gerar sua mensagem.
2. Analise o contexto: a pessoa demonstrou interesse? Recusou? Ignorou? Pediu para não ser contatada?
3. Gere UMA ÚNICA mensagem 100% personalizada baseada no histórico + contexto fornecido.
4. Sempre se apresente pelo seu nome (${agentName}).

COMPORTAMENTO INTELIGENTE:
- Se a pessoa RECUSOU (ex: "não obrigado", "não tenho interesse", "não quero", "para de mandar") → envie APENAS uma mensagem cordial de agradecimento e encerramento. NÃO tente vender ou insistir. Exemplo: "Entendido, [nome]! Agradeço pelo tempo. Qualquer coisa no futuro, estou à disposição. Tenha um ótimo dia! 😊"
- Se a pessoa IGNOROU sem responder → retome a conversa de forma natural, se apresente e ofereça ajuda com base no contexto fornecido.
- Se a pessoa DEMONSTROU INTERESSE mas não converteu → continue de onde a conversa parou, personalizando com base no que foi discutido.

REGRAS DE ESTILO:
- Tom humano, leve e em português brasileiro informal
- Nunca soar robótico, repetitivo ou insistente
- Mensagem curta e direta (máximo 3 parágrafos)
- Use emojis com moderação (1-2 por mensagem)
- NÃO comece com "Olá" genérico se já teve conversa anterior — vá direto ao ponto

RESPONDA APENAS com o texto da mensagem. Sem explicações adicionais.`;

      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...history.filter(h => h.content).map(h => ({ role: h.role, content: h.content })),
        { role: "user", content: "[GERAR MENSAGEM DE FOLLOW-UP AGORA]" },
      ];

      if (!lovableApiKey) {
        return new Response(JSON.stringify({ error: "AI API key not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure model uses gateway-compatible format (must have provider prefix)
      // The Lovable gateway only supports openai/* and google/* models
      let model = agent.model || "openai/gpt-5-mini";
      // If model has no prefix or uses unsupported provider (anthropic), default to openai/gpt-5-mini
      if (!model.includes("/") || model.startsWith("anthropic/")) {
        model = "openai/gpt-5-mini";
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: aiMessages,
          temperature: 0.8,
          max_tokens: 500,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => "");
        console.error("[followup-inteligente] AI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const generatedMessage = aiData.choices?.[0]?.message?.content?.trim() || "";

      if (!generatedMessage) {
        return new Response(JSON.stringify({ error: "Empty AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ message: generatedMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================
    // ACTION: send - Send message via correct channel
    // ========================
    if (action === "send") {
      const { instance_type, instance_name, meta_page_id, contact_phone, sender_id, message, workspace_id } = body;

      if (!message || !contact_phone || !workspace_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (instance_type === "waba" && meta_page_id) {
        // Send via Meta Cloud API (same logic as meta-send-message)
        const { data: page, error: pageError } = await supabase
          .from("meta_pages")
          .select("id, page_id, page_access_token, platform, instagram_account_id, workspace_id")
          .eq("id", meta_page_id)
          .eq("is_active", true)
          .single();

        if (pageError || !page) {
          return new Response(JSON.stringify({ error: "Meta page not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let graphUrl: string;
        let graphPayload: Record<string, unknown>;

        if (page.platform === "whatsapp_business") {
          graphUrl = `https://graph.facebook.com/v21.0/${page.page_id}/messages`;
          graphPayload = {
            messaging_product: "whatsapp",
            to: sender_id || contact_phone,
            type: "text",
            text: { body: message },
          };
        } else if (page.platform === "instagram" || page.instagram_account_id) {
          graphUrl = `https://graph.facebook.com/v21.0/${page.instagram_account_id || page.page_id}/messages`;
          graphPayload = { recipient: { id: sender_id || contact_phone }, message: { text: message } };
        } else {
          graphUrl = `https://graph.facebook.com/v21.0/${page.page_id}/messages`;
          graphPayload = { recipient: { id: sender_id || contact_phone }, message: { text: message } };
        }

        const graphRes = await fetch(graphUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${page.page_access_token}` },
          body: JSON.stringify(graphPayload),
        });

        const graphData = await graphRes.json();

        if (!graphRes.ok) {
          return new Response(JSON.stringify({ error: "Graph API error", details: graphData }), {
            status: graphRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save to meta_conversations
        const outboundMessageId = graphData.message_id || graphData.messages?.[0]?.id || `followup-${Date.now()}`;
        const platform = page.instagram_account_id ? "instagram"
          : (page.platform === "whatsapp_business" ? "whatsapp_business" : "facebook");

        await supabase.from("meta_conversations").insert({
          meta_page_id: page.id,
          platform,
          sender_id: sender_id || contact_phone,
          message_id: outboundMessageId,
          content: message,
          message_type: "text",
          direction: "outbound",
          timestamp: new Date().toISOString(),
          raw_payload: graphData,
          workspace_id: page.workspace_id,
        });

        return new Response(JSON.stringify({ success: true, message_id: outboundMessageId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } else if (instance_type === "evolution" && instance_name) {
        // Send via Evolution API
        let number = contact_phone.replace(/\D/g, "");
        if ((number.length === 10 || number.length === 11) && !number.startsWith("55")) {
          number = "55" + number;
        }

        const evoRes = await fetch(`${evolutionApiUrl}/message/sendText/${instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({ number, text: message }),
        });

        if (!evoRes.ok) {
          const errData = await evoRes.json().catch(() => ({}));
          return new Response(JSON.stringify({ error: "Evolution API error", details: errData }), {
            status: evoRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save to whatsapp_messages
        const jid = `${number}@s.whatsapp.net`;
        await supabase.from("whatsapp_messages").insert({
          workspace_id,
          instance_name,
          remote_jid: jid,
          direction: "sent",
          content: message,
          message_type: "text",
          from_me: true,
          timestamp: new Date().toISOString(),
          message_id: `followup-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } else {
        return new Response(JSON.stringify({ error: "Invalid instance configuration" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[followup-inteligente] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
