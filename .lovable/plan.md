

## Feature 2: Resumo automático de conversas

### O que será feito
Botão "Resumir conversa" no painel lateral do chat (`LeadSidePanel`). Ao clicar, busca as últimas mensagens e gera um resumo com IA via nova edge function.

### Alterações

**1. Nova edge function `supabase/functions/summarize-conversation/index.ts`**
- Recebe: `remoteJid`, `instanceName`, `workspaceId`
- Busca últimas 50 mensagens de `whatsapp_messages` (ordenadas por `message_timestamp desc`)
- Chama Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) com modelo `google/gemini-2.5-flash`
- Prompt em português: "Resuma esta conversa em 3-5 linhas. Destaque: assunto principal, interesse do cliente, último pedido/dúvida."
- Retorna `{ summary: string }`
- Usa `LOVABLE_API_KEY` (já configurado) + `SUPABASE_SERVICE_ROLE_KEY`

**2. `src/components/chat/LeadSidePanel.tsx`**
- Adicionar botão "Resumir conversa" com ícone `FileText` no header do painel (abaixo das tags, acima do funil)
- Estado: `summary` (string | null), `loadingSummary` (boolean)
- Ao clicar → chama `supabase.functions.invoke("summarize-conversation", { body: { remoteJid, instanceName, workspaceId } })`
- Exibe resumo em card colapsável com fundo sutil
- Botão muda para "Atualizar resumo" quando já tem resumo exibido
- Props: precisa receber `remoteJid` e `instanceName` do chat atual (já disponíveis via `chatContact`)
- Precisa receber `workspaceId` — adicionar à interface de props

**3. `src/pages/Chats.tsx`**
- Passar `workspaceId` como prop para `LeadSidePanel` (já disponível no componente via `useWorkspace`)

### Nenhuma alteração de banco necessária
As mensagens já estão em `whatsapp_messages`. O resumo é gerado on-demand, sem persistir.

