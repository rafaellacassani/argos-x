

## Plano: Áudio em Campanhas + Campanhas para toda a base

### Situação atual

**Áudio**: O sistema já suporta upload de arquivos (imagem, vídeo, documento) como anexo de campanha, e o `process-campaigns` já envia via `sendMedia` do Evolution API. Porém, não existe opção de **gravar áudio** direto — só upload de arquivo.

**Base de contatos**: O `prepare-campaign` busca **apenas da tabela `leads`**. O webhook só cria leads automaticamente quando há um bot/agente ativo que responde. Se não houver bot configurado, o webhook retorna sem criar lead (linha 1092 do `whatsapp-webhook`). Isso significa que muitos contatos que conversaram no WhatsApp não viram leads e ficam fora das campanhas.

---

### Correção 1: Gravação de áudio na criação de campanha

**Arquivo**: `src/components/campaigns/CreateCampaignDialog.tsx`

- Adicionar botão de gravação de áudio no Step 2 (Mensagem), ao lado do botão de upload de arquivo
- Usar `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder` (mesma lógica do `ChatInput.tsx`)
- Ao finalizar gravação, fazer upload do blob para o bucket `campaign-attachments` como `.ogg`
- Setar `attachmentUrl` com a URL pública e `attachmentType = "audio"`
- A mensagem de texto se torna **opcional** quando há áudio (remover validação obrigatória de `messageText`)
- O `process-campaigns` já trata `attachment_type: "audio"` via `sendMedia` — nenhuma mudança no backend

**Validação no Step 2** (`canProceed`): Permitir avançar se tiver `messageText` OU `attachmentUrl` (hoje exige messageText obrigatório).

---

### Correção 2: Incluir contatos que não são leads nas campanhas

**Abordagem**: Adicionar um toggle "Incluir todos os contatos do WhatsApp" no Step 1 do `CreateCampaignDialog`. Quando ativo, o `prepare-campaign` também busca números únicos da tabela `whatsapp_messages` que não existem como leads.

**Arquivo**: `src/components/campaigns/CreateCampaignDialog.tsx`
- Novo estado `includeAllContacts` (boolean)
- Toggle no Step 1: "Incluir contatos do WhatsApp (não-leads)"
- Salvar flag no campo existente ou em novo campo da campanha

**Arquivo**: DB migration
- Adicionar coluna `include_all_contacts boolean default false` à tabela `campaigns`

**Arquivo**: `src/hooks/useCampaigns.ts`
- Adicionar `include_all_contacts` à interface `Campaign` e `CreateCampaignData`

**Arquivo**: `supabase/functions/prepare-campaign/index.ts`
- Quando `campaign.include_all_contacts === true`:
  - Após buscar leads, também buscar `DISTINCT remote_jid` da `whatsapp_messages` para o workspace
  - Extrair número limpo de cada `remote_jid` (remover `@s.whatsapp.net`)
  - Filtrar os que já existem como lead (para não duplicar)
  - Adicionar como recipients com `lead_id = null`, `phone = número`, `personalized_message = message_text` (sem shortcodes personalizados)

**Arquivo**: `supabase/functions/process-campaigns/index.ts`
- Já funciona com `recipient.phone` — não precisa de `lead_id` obrigatório para enviar

**Arquivo**: `src/hooks/useCampaigns.ts` (estimateRecipients)
- Quando `includeAllContacts`, fazer query adicional em `whatsapp_messages` para contar números únicos que não são leads

---

### Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| DB migration | Coluna `include_all_contacts` em `campaigns` |
| `CreateCampaignDialog.tsx` | Gravação de áudio + toggle "incluir todos contatos" |
| `useCampaigns.ts` | Interface + estimativa incluindo não-leads |
| `prepare-campaign/index.ts` | Buscar contatos de `whatsapp_messages` quando flag ativa |
| `CampaignDetailDialog.tsx` | Exibir info de áudio + flag no detalhe |

