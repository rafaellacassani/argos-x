import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AgentConfig {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools: any[];
  pause_code: string;
  resume_keyword: string;
  message_split_enabled: boolean;
  message_split_length: number;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

// Split long messages into chunks (like n8n Parser Chain)
function splitMessage(text: string, maxLength: number = 400): string[] {
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    // Try to split at sentence boundaries
    let splitIndex = remaining.lastIndexOf(". ", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }
    
    chunks.push(remaining.substring(0, splitIndex + 1).trim());
    remaining = remaining.substring(splitIndex + 1).trim();
  }
  
  return chunks;
}

// Define available tools for the agent
function getToolDefinitions(enabledTools: string[]) {
  const allTools = [
    {
      type: "function",
      function: {
        name: "atualizar_lead",
        description: "Atualiza dados de um lead no CRM (nome, email, telefone, notas, valor)",
        parameters: {
          type: "object",
          properties: {
            lead_id: { type: "string", description: "ID do lead" },
            name: { type: "string", description: "Nome do lead" },
            email: { type: "string", description: "Email do lead" },
            phone: { type: "string", description: "Telefone do lead" },
            notes: { type: "string", description: "Notas ou observações" },
            value: { type: "number", description: "Valor potencial do lead" }
          },
          required: ["lead_id"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "aplicar_tag",
        description: "Aplica uma tag a um lead para classificação",
        parameters: {
          type: "object",
          properties: {
            lead_id: { type: "string", description: "ID do lead" },
            tag_name: { type: "string", description: "Nome da tag a aplicar" }
          },
          required: ["lead_id", "tag_name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "mover_etapa",
        description: "Move um lead para outra etapa do funil de vendas",
        parameters: {
          type: "object",
          properties: {
            lead_id: { type: "string", description: "ID do lead" },
            stage_name: { type: "string", description: "Nome da nova etapa" }
          },
          required: ["lead_id", "stage_name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "pausar_ia",
        description: "Pausa o atendimento da IA e transfere para um humano",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Motivo da pausa" }
          },
          required: ["reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "chamar_n8n",
        description: "Executa um workflow do n8n via webhook",
        parameters: {
          type: "object",
          properties: {
            webhook_url: { type: "string", description: "URL do webhook do n8n" },
            payload: { type: "object", description: "Dados a enviar para o n8n" }
          },
          required: ["webhook_url"]
        }
      }
    }
  ];
  
  if (!enabledTools || enabledTools.length === 0) {
    return allTools.slice(0, 4); // Default tools
  }
  
  return allTools.filter(t => enabledTools.includes(t.function.name));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { agent_id, session_id, message, lead_id } = await req.json();
    
    if (!agent_id || !session_id || !message) {
      return new Response(
        JSON.stringify({ error: "agent_id, session_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get agent configuration
    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("id", agent_id)
      .single();

    if (agentError || !agent) {
      console.error("Agent not found:", agentError);
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agent.is_active) {
      return new Response(
        JSON.stringify({ error: "Agent is not active", paused: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create memory for this session
    let { data: memory, error: memoryError } = await supabase
      .from("agent_memories")
      .select("*")
      .eq("agent_id", agent_id)
      .eq("session_id", session_id)
      .single();

    if (memoryError && memoryError.code !== "PGRST116") {
      console.error("Memory fetch error:", memoryError);
    }

    // Check if conversation is paused
    if (memory?.is_paused) {
      // Check for resume keyword
      if (message.toLowerCase().includes(agent.resume_keyword.toLowerCase())) {
        await supabase
          .from("agent_memories")
          .update({ is_paused: false })
          .eq("id", memory.id);
        memory.is_paused = false;
      } else {
        return new Response(
          JSON.stringify({ 
            response: null, 
            paused: true, 
            message: "Conversa pausada. Aguardando atendimento humano." 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check for pause code
    if (message.includes(agent.pause_code)) {
      if (memory) {
        await supabase
          .from("agent_memories")
          .update({ is_paused: true })
          .eq("id", memory.id);
      }
      
      // Log execution
      await supabase.from("agent_executions").insert({
        agent_id,
        lead_id,
        session_id,
        input_message: message,
        output_message: null,
        status: "paused",
        latency_ms: Date.now() - startTime
      });

      return new Response(
        JSON.stringify({ 
          response: null, 
          paused: true, 
          message: "Atendimento pausado. Um humano assumirá a conversa." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get conversation history
    const messages: ChatMessage[] = memory?.messages || [];
    
    // Add user message to history
    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);

    // Prepare messages for AI (limit context window)
    const contextWindow = memory?.context_window || agent.max_tokens || 50;
    const recentMessages = messages.slice(-contextWindow);

    // Build AI request
    const aiMessages = [
      { role: "system", content: agent.system_prompt },
      ...recentMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    const enabledToolNames = agent.tools || [];
    const tools = getToolDefinitions(enabledToolNames);

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json"
      },
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
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiChoice = aiData.choices?.[0];
    
    if (!aiChoice) {
      throw new Error("No response from AI");
    }

    let responseContent = aiChoice.message?.content || "";
    const toolCalls = aiChoice.message?.tool_calls || [];
    const toolsUsed: string[] = [];

    // Handle tool calls
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name;
      const toolArgs = JSON.parse(toolCall.function?.arguments || "{}");
      
      console.log(`Executing tool: ${toolName}`, toolArgs);
      toolsUsed.push(toolName);

      switch (toolName) {
        case "atualizar_lead":
          if (lead_id || toolArgs.lead_id) {
            const updateData: any = {};
            if (toolArgs.name) updateData.name = toolArgs.name;
            if (toolArgs.email) updateData.email = toolArgs.email;
            if (toolArgs.phone) updateData.phone = toolArgs.phone;
            if (toolArgs.notes) updateData.notes = toolArgs.notes;
            if (toolArgs.value) updateData.value = toolArgs.value;
            
            await supabase
              .from("leads")
              .update(updateData)
              .eq("id", lead_id || toolArgs.lead_id);
          }
          break;

        case "aplicar_tag":
          if (lead_id || toolArgs.lead_id) {
            // Find or create tag
            let { data: tag } = await supabase
              .from("lead_tags")
              .select("id")
              .eq("name", toolArgs.tag_name)
              .single();
            
            if (!tag) {
              const { data: newTag } = await supabase
                .from("lead_tags")
                .insert({ name: toolArgs.tag_name, color: "#6B7280" })
                .select("id")
                .single();
              tag = newTag;
            }
            
            if (tag) {
              await supabase
                .from("lead_tag_assignments")
                .upsert({
                  lead_id: lead_id || toolArgs.lead_id,
                  tag_id: tag.id
                }, { onConflict: "lead_id,tag_id" });
            }
          }
          break;

        case "mover_etapa":
          if (lead_id || toolArgs.lead_id) {
            const { data: stage } = await supabase
              .from("funnel_stages")
              .select("id")
              .ilike("name", `%${toolArgs.stage_name}%`)
              .single();
            
            if (stage) {
              await supabase
                .from("leads")
                .update({ stage_id: stage.id })
                .eq("id", lead_id || toolArgs.lead_id);
            }
          }
          break;

        case "pausar_ia":
          if (memory) {
            await supabase
              .from("agent_memories")
              .update({ is_paused: true })
              .eq("id", memory.id);
          }
          responseContent += `\n\n[Atendimento transferido para humano. Motivo: ${toolArgs.reason}]`;
          break;

        case "chamar_n8n":
          try {
            await fetch(toolArgs.webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...toolArgs.payload,
                lead_id,
                session_id,
                agent_id
              })
            });
          } catch (n8nError) {
            console.error("n8n webhook error:", n8nError);
          }
          break;
      }
    }

    // Add assistant response to history
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: responseContent,
      timestamp: new Date().toISOString()
    };
    messages.push(assistantMessage);

    // Save or update memory
    if (memory) {
      await supabase
        .from("agent_memories")
        .update({
          messages,
          lead_id: lead_id || memory.lead_id
        })
        .eq("id", memory.id);
    } else {
      await supabase
        .from("agent_memories")
        .insert({
          agent_id,
          session_id,
          lead_id,
          messages
        });
    }

    // Split response if needed
    let responseChunks = [responseContent];
    if (agent.message_split_enabled && responseContent.length > agent.message_split_length) {
      responseChunks = splitMessage(responseContent, agent.message_split_length);
    }

    const latencyMs = Date.now() - startTime;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    // Log execution
    await supabase.from("agent_executions").insert({
      agent_id,
      lead_id,
      session_id,
      input_message: message,
      output_message: responseContent,
      tools_used: toolsUsed,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      status: "success"
    });

    // Update agent execution count
    await supabase.rpc("increment_agent_executions", { agent_id_param: agent_id });

    return new Response(
      JSON.stringify({
        response: responseContent,
        chunks: responseChunks,
        tools_used: toolsUsed,
        tokens_used: tokensUsed,
        latency_ms: latencyMs
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Agent chat error:", error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
