

## Diagnóstico: Agentes de IA na WhatsApp Cloud API

### Situação Atual

1. **Agentes de IA funcionam APENAS com Evolution API** (instâncias em `whatsapp_instances`). O webhook `whatsapp-webhook` é o único que roteia mensagens para `ai-agent-chat`.

2. **O webhook `facebook-webhook`** (que recebe mensagens da Cloud API/WABA) apenas **salva na tabela `meta_conversations`** e NÃO chama o agente de IA.

3. **Na tela de Comportamento do agente**, o seletor "Instância WhatsApp" só lista instâncias da tabela `whatsapp_instances` (Evolution), ignorando conexões Cloud API (`whatsapp_cloud_connections`).

### Sobre usar 1 agente em múltiplas instâncias

Sim, já é possível! Se o campo `instance_name` do agente estiver vazio (opção "Todas as instâncias"), ele responde em qualquer instância Evolution. O plano abaixo estende isso para incluir Cloud API.

---

### Plano de Implementação

#### 1. Edge Function `facebook-webhook` -- Rotear para AI Agent
Após salvar a mensagem inbound na `meta_conversations`, adicionar lógica para:
- Buscar o `workspace_id` via `meta_page`
- Buscar agentes ativos naquele workspace
- Verificar se o agente responde a "todas" ou à instância Cloud API específica
- Chamar `supabase.functions.invoke("ai-agent-chat")` com os dados da mensagem (similar ao que `whatsapp-webhook` faz)
- Enviar a resposta via Graph API (usando o `access_token` da `whatsapp_cloud_connections`)

#### 2. Edge Function `ai-agent-chat` -- Suportar resposta via Cloud API
Atualmente a resposta do agente é enviada via Evolution API (`sendText`). Precisamos:
- Aceitar um parâmetro `channel_type: "evolution" | "whatsapp_cloud"` e `cloud_connection_id`
- Se `channel_type === "whatsapp_cloud"`, enviar via Graph API (`POST https://graph.facebook.com/v21.0/{phone_number_id}/messages`) ao invés de Evolution API
- Manter compatibilidade com o fluxo Evolution existente

#### 3. Frontend `BehaviorTab.tsx` -- Listar instâncias Cloud API
- Além de buscar `whatsapp_instances`, buscar `whatsapp_cloud_connections` ativas
- Exibir ambas no seletor com indicador visual (ex: "📱 Evolution" vs "☁️ Cloud API")
- Permitir "Todas" (responde em qualquer uma, incluindo Cloud API)

#### 4. Edge Function `meta-send-message` -- Suportar envio WABA
- Verificar se já suporta envio via Cloud API para WhatsApp Business, ou adicionar suporte

### Arquivos Alterados
- `supabase/functions/facebook-webhook/index.ts` -- adicionar roteamento para AI Agent
- `supabase/functions/ai-agent-chat/index.ts` -- suportar canal Cloud API
- `src/components/agents/tabs/BehaviorTab.tsx` -- listar conexões Cloud API
- Possivelmente `supabase/functions/meta-send-message/index.ts`

### Complexidade
Moderada-alta. Envolve 3-4 edge functions e coordenação entre canais. O fluxo principal é replicar a lógica de roteamento do `whatsapp-webhook` dentro do `facebook-webhook`.

