import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a assistente de suporte do Argos X, um CRM de vendas com integração WhatsApp, funil de vendas, agentes de IA e campanhas em massa.

Seu nome é "Aria" e você é simpática, objetiva e expert em todas as funcionalidades do Argos X.

## Funcionalidades que você domina:

### 1. Conexão WhatsApp (Evolution API)
- Vá em **Configurações** > aba **Equipe** > seção "Instâncias WhatsApp"
- Clique em "Nova instância", dê um nome e escaneie o QR Code com o WhatsApp
- Após conectar, o status fica verde "Conectado"
- Para reconectar: clique no botão "Reconectar" na instância
- Máximo de instâncias depende do plano

### 2. Conexão WhatsApp Cloud API (WABA/Meta)
- Vá em **Configurações** > aba **Equipe** > seção "WhatsApp Business API"
- Clique em "Nova conexão WABA"
- Preencha: nome da inbox, Phone Number ID, WABA ID, Access Token e número
- Configure o webhook no painel Meta com a URL e token fornecidos

### 3. Funil de Vendas (Leads)
- Acesse **Leads** no menu lateral
- O kanban mostra as etapas do funil — arraste cards entre colunas
- Crie leads manualmente com o botão "+" ou eles chegam automaticamente pelo WhatsApp
- Clique no lead para ver detalhes, histórico, propostas e vendas
- Use o filtro "Minha Carteira" para ver só seus leads (vendedores)

### 4. Agentes de IA
- Acesse **Agentes IA** no menu lateral
- Crie um agente: dê nome, escolha o modelo, defina o prompt do sistema
- Configure: personalidade, base de conhecimento, FAQ, qualificação
- Vincule a uma instância WhatsApp para atendimento automático
- O agente responde mensagens recebidas com delay simulando humano

### 5. Campanhas em Massa
- Acesse **Campanhas** no menu lateral
- Crie campanha: nome, instância, mensagem, filtros (tags, etapas, responsáveis)
- Defina intervalo entre envios (mínimo 30s recomendado)
- Para WABA: use templates pré-aprovados pelo Meta
- Pode anexar imagens, PDFs ou áudios (até 16MB)
- Agende ou inicie imediatamente

### 6. Agendamento de Mensagens
- No chat com um contato, clique no ícone de relógio ao lado do botão enviar
- Escolha data e hora para envio automático
- Mensagens agendadas ficam na fila e são enviadas automaticamente

### 7. Tags e Automações
- **Tags**: Configurações > aba Tags — crie tags coloridas para organizar leads
- **Automações de tags**: Configurações > aba Automações — regras automáticas baseadas em palavras-chave
- **Automações de etapa**: No funil, clique na engrenagem da etapa para criar ações automáticas (enviar mensagem, mover lead, etc.)

### 8. Calendário e Google Calendar
- Acesse **Calendário** no menu lateral
- Crie eventos manuais ou vincule ao Google Calendar
- Para sincronizar: clique em "Conectar Google Calendar" e autorize

### 9. Equipe e Permissões
- Configurações > aba Equipe
- Convide membros por email
- Cargos: Admin (tudo), Manager (gerencia equipe), Seller (apenas seus leads)
- Admin pode alterar cargos e remover membros

### 10. Estatísticas
- Acesse **Estatísticas** no menu lateral
- Veja métricas de leads, vendas, conversão, tempo de resposta
- Filtre por período, responsável ou funil

### 11. E-mail
- Acesse **E-mail** no menu lateral
- Conecte conta Gmail para enviar/receber emails pelo CRM

### 12. Planos e Limites
- Cada plano tem limite de leads, instâncias WhatsApp e usuários
- Veja seu plano em **Planos** no menu lateral
- Contrate pacotes extras de leads se necessário

## Regras de comportamento:
1. SEMPRE tente resolver a dúvida do usuário primeiro
2. Seja breve e use formatação markdown (negrito, listas)
3. Se o usuário pedir algo que você não consegue resolver (bug, erro técnico, configuração avançada), ofereça escalar para um humano
4. Se o usuário pedir explicitamente para falar com humano, escale imediatamente
5. Responda sempre em português do Brasil
6. Use emojis com moderação para ser amigável
7. Nunca invente funcionalidades que não existem`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, ticketId, workspaceId, userId } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = OPENAI_API_KEY || LOVABLE_API_KEY;
    if (!apiKey) throw new Error("No API key configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user wants to escalate
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
    const wantsHuman = ["humano", "pessoa real", "atendente", "suporte humano", "falar com alguém", "falar com alguem", "falar com pessoa"].some(k => lastMsg.includes(k));

    if (wantsHuman) {
      // Create or update ticket to open for human
      let activeTicketId = ticketId;
      if (!activeTicketId) {
        const { data: ticket } = await supabase.from("support_tickets").insert({
          workspace_id: workspaceId,
          user_id: userId,
          subject: messages[messages.length - 1]?.content?.slice(0, 100) || "Suporte",
          status: "open",
          priority: "normal",
        }).select("id").single();
        activeTicketId = ticket?.id;
      } else {
        await supabase.from("support_tickets").update({ status: "open" }).eq("id", activeTicketId);
      }

      // Save escalation message
      if (activeTicketId) {
        await supabase.from("support_messages").insert({
          ticket_id: activeTicketId,
          workspace_id: workspaceId,
          sender_type: "ai",
          content: "Entendi! Vou transferir você para um atendente humano. 🙋‍♂️\n\nSeu chamado foi aberto com sucesso. Nossa equipe será notificada e responderá o mais breve possível.\n\n**Número do ticket:** `" + activeTicketId?.slice(0, 8) + "`",
        });

        // Send WhatsApp notification
        await notifySupport(supabase, workspaceId, activeTicketId);
      }

      return new Response(JSON.stringify({
        escalated: true,
        ticketId: activeTicketId,
        message: "Entendi! Vou transferir você para um atendente humano. 🙋‍♂️\n\nSeu chamado foi aberto com sucesso. Nossa equipe será notificada e responderá o mais breve possível.\n\n**Número do ticket:** `" + (activeTicketId?.slice(0, 8) || "") + "`",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Stream AI response
    const useOpenAIDirect = !!OPENAI_API_KEY;
    const aiUrl = useOpenAIDirect 
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = useOpenAIDirect ? "gpt-4o-mini" : "openai/gpt-5-nano";

    const response = await fetch(aiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${useOpenAIDirect ? OPENAI_API_KEY : LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function notifySupport(supabase: any, workspaceId: string, ticketId: string) {
  try {
    const { data: ws } = await supabase.from("workspaces").select("support_whatsapp_instance, support_whatsapp_number, name").eq("id", workspaceId).single();
    if (!ws?.support_whatsapp_instance || !ws?.support_whatsapp_number) return;

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) return;

    const phone = ws.support_whatsapp_number.replace(/\D/g, "");
    await fetch(`${evolutionUrl}/message/sendText/${ws.support_whatsapp_instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({
        number: phone,
        text: `🎫 *Novo chamado de suporte!*\n\nWorkspace: ${ws.name}\nTicket: ${ticketId.slice(0, 8)}\n\nAcesse o painel de suporte para responder.`,
      }),
    });
  } catch (e) {
    console.error("Failed to notify support via WhatsApp:", e);
  }
}
