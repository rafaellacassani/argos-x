import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

function splitMessage(text: string, maxLength: number = 400): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) { chunks.push(remaining); break; }
    let splitIndex = remaining.lastIndexOf(". ", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) splitIndex = remaining.lastIndexOf(" ", maxLength);
    if (splitIndex === -1) splitIndex = maxLength;
    chunks.push(remaining.substring(0, splitIndex + 1).trim());
    remaining = remaining.substring(splitIndex + 1).trim();
  }
  return chunks;
}

function getToolDefinitions(enabledTools: string[]) {
  const allTools = [
    {
      type: "function",
      function: {
        name: "atualizar_lead",
        description: "Atualiza dados de um lead no CRM",
        parameters: { type: "object", properties: { lead_id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, notes: { type: "string" }, value: { type: "number" } }, required: ["lead_id"] }
      }
    },
    {
      type: "function",
      function: {
        name: "aplicar_tag",
        description: "Aplica uma tag a um lead",
        parameters: { type: "object", properties: { lead_id: { type: "string" }, tag_name: { type: "string" } }, required: ["lead_id", "tag_name"] }
      }
    },
    {
      type: "function",
      function: {
        name: "mover_etapa",
        description: "Move um lead para outra etapa do funil",
        parameters: { type: "object", properties: { lead_id: { type: "string" }, stage_name: { type: "string" } }, required: ["lead_id", "stage_name"] }
      }
    },
    {
      type: "function",
      function: {
        name: "pausar_ia",
        description: "Pausa o atendimento da IA",
        parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] }
      }
    },
  ];
  if (!enabledTools || enabledTools.length === 0) return allTools;
  return allTools.filter(t => enabledTools.includes(t.function.name));
}

// Validate UUID format
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // --- AUTH CHECK ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // Verify JWT
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- INPUT VALIDATION ---
    const body = await req.json();
    const { agent_id, session_id, message, lead_id } = body;

    if (!agent_id || !session_id || !message) {
      return new Response(JSON.stringify({ error: "agent_id, session_id and message are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isValidUUID(agent_id)) {
      return new Response(JSON.stringify({ error: "Invalid agent_id format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof session_id !== "string" || session_id.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid session_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof message !== "string" || message.length > 4000 || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message must be 1-4000 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (lead_id && !isValidUUID(lead_id)) {
      return new Response(JSON.stringify({ error: "Invalid lead_id format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: agent, error: agentError } = await supabase
      .from("ai_agents").select("*").eq("id", agent_id).single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!agent.is_active) {
      return new Response(JSON.stringify({ error: "Agent is not active", paused: true }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let { data: memory, error: memoryError } = await supabase
      .from("agent_memories").select("*").eq("agent_id", agent_id).eq("session_id", session_id).single();
    if (memoryError && memoryError.code !== "PGRST116") {
      console.error("Memory fetch error:", memoryError);
    }

    if (memory?.is_paused) {
      if (message.toLowerCase().includes((agent.resume_keyword || "").toLowerCase())) {
        await supabase.from("agent_memories").update({ is_paused: false }).eq("id", memory.id);
        memory.is_paused = false;
      } else {
        return new Response(JSON.stringify({ response: null, paused: true, message: "Conversa pausada." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (agent.pause_code && message.includes(agent.pause_code)) {
      if (memory) {
        await supabase.from("agent_memories").update({ is_paused: true }).eq("id", memory.id);
      }
      await supabase.from("agent_executions").insert({ agent_id, lead_id, session_id, input_message: message, output_message: null, status: "paused", latency_ms: Date.now() - startTime });
      return new Response(JSON.stringify({ response: null, paused: true, message: "Atendimento pausado." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messages: ChatMessage[] = memory?.messages || [];
    messages.push({ role: "user", content: message, timestamp: new Date().toISOString() });

    const contextWindow = memory?.context_window || agent.max_tokens || 50;
    const recentMessages = messages.slice(-contextWindow);
    const aiMessages = [
      { role: "system", content: agent.system_prompt },
      ...recentMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    const tools = getToolDefinitions(agent.tools || []);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: agent.model || "google/gemini-3-flash-preview",
        messages: aiMessages,
        temperature: agent.temperature || 0.7,
        max_tokens: agent.max_tokens || 2048,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiChoice = aiData.choices?.[0];
    if (!aiChoice) throw new Error("No response from AI");

    let responseContent = aiChoice.message?.content || "";
    const toolCalls = aiChoice.message?.tool_calls || [];
    const toolsUsed: string[] = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name;
      const toolArgs = JSON.parse(toolCall.function?.arguments || "{}");
      toolsUsed.push(toolName);

      switch (toolName) {
        case "atualizar_lead": {
          const targetLeadId = lead_id || toolArgs.lead_id;
          if (targetLeadId && isValidUUID(targetLeadId)) {
            const updateData: Record<string, unknown> = {};
            if (typeof toolArgs.name === "string" && toolArgs.name.length <= 200) updateData.name = toolArgs.name;
            if (typeof toolArgs.email === "string" && toolArgs.email.length <= 255) updateData.email = toolArgs.email;
            if (typeof toolArgs.phone === "string" && toolArgs.phone.length <= 30) updateData.phone = toolArgs.phone;
            if (typeof toolArgs.notes === "string" && toolArgs.notes.length <= 2000) updateData.notes = toolArgs.notes;
            if (typeof toolArgs.value === "number") updateData.value = toolArgs.value;
            if (Object.keys(updateData).length > 0) {
              await supabase.from("leads").update(updateData).eq("id", targetLeadId);
            }
          }
          break;
        }
        case "aplicar_tag": {
          const targetLeadId = lead_id || toolArgs.lead_id;
          if (targetLeadId && isValidUUID(targetLeadId) && typeof toolArgs.tag_name === "string" && toolArgs.tag_name.length <= 100) {
            let { data: tag } = await supabase.from("lead_tags").select("id").eq("name", toolArgs.tag_name).single();
            if (!tag) {
              const { data: newTag } = await supabase.from("lead_tags").insert({ name: toolArgs.tag_name, color: "#6B7280" }).select("id").single();
              tag = newTag;
            }
            if (tag) {
              await supabase.from("lead_tag_assignments").upsert({ lead_id: targetLeadId, tag_id: tag.id }, { onConflict: "lead_id,tag_id" });
            }
          }
          break;
        }
        case "mover_etapa": {
          const targetLeadId = lead_id || toolArgs.lead_id;
          if (targetLeadId && isValidUUID(targetLeadId) && typeof toolArgs.stage_name === "string" && toolArgs.stage_name.length <= 100) {
            // Use parameterized ilike - Supabase SDK handles escaping
            const { data: stage } = await supabase.from("funnel_stages").select("id").ilike("name", `%${toolArgs.stage_name}%`).single();
            if (stage) {
              await supabase.from("leads").update({ stage_id: stage.id }).eq("id", targetLeadId);
            }
          }
          break;
        }
        case "pausar_ia":
          if (memory) {
            await supabase.from("agent_memories").update({ is_paused: true }).eq("id", memory.id);
          }
          responseContent += `\n\n[Atendimento transferido para humano. Motivo: ${typeof toolArgs.reason === "string" ? toolArgs.reason.substring(0, 200) : "N/A"}]`;
          break;
        // chamar_n8n removed - SSRF risk from arbitrary webhook URLs
      }
    }

    messages.push({ role: "assistant", content: responseContent, timestamp: new Date().toISOString() });

    if (memory) {
      await supabase.from("agent_memories").update({ messages, lead_id: lead_id || memory.lead_id }).eq("id", memory.id);
    } else {
      await supabase.from("agent_memories").insert({ agent_id, session_id, lead_id, messages });
    }

    let responseChunks = [responseContent];
    if (agent.message_split_enabled && responseContent.length > (agent.message_split_length || 400)) {
      responseChunks = splitMessage(responseContent, agent.message_split_length || 400);
    }

    const latencyMs = Date.now() - startTime;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    await supabase.from("agent_executions").insert({ agent_id, lead_id, session_id, input_message: message, output_message: responseContent, tools_used: toolsUsed, tokens_used: tokensUsed, latency_ms: latencyMs, status: "success" });
    await supabase.rpc("increment_agent_executions", { agent_id_param: agent_id });

    return new Response(JSON.stringify({ response: responseContent, chunks: responseChunks, tools_used: toolsUsed, tokens_used: tokensUsed, latency_ms: latencyMs }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Agent chat error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
