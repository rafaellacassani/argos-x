

## Plano de implementação — Features CRM Argos X

### Ordem de implementação
1. **Contador de tempo + prioridade visual** (impacto visual imediato no Kanban)
2. **Resumo automático de conversas** (útil no chat e no painel lateral)
3. **Botão de ação rápida** (no Kanban + no Chat individual)
4. **Classificação de leads com IA** (scoring 0-100, badge Quente/Morno/Frio)

> Item 3 (filtro por canal/fonte) **já existe** em LeadFilters — campo `sources` com opções WhatsApp, Facebook, Instagram, Importação, Manual. Nada a fazer.
> Item 5 (próximo passo sugerido) fica para depois, conforme combinado.

---

### Feature 1: Contador de tempo + prioridade visual no Kanban

**O que faz**: Mostra no card do lead há quanto tempo ele está **sem interação/parado na etapa**, com cores de urgência. Cards mais urgentes sobem visualmente.

**Alterações**:

**`src/components/leads/LeadCard.tsx`**
- Calcular tempo desde `lead.updated_at` (última interação/movimentação)
- Exibir badge com tempo: "2h", "1d", "3d", "7d+"
- Cores de urgência:
  - Verde: < 24h
  - Amarelo: 24h–48h
  - Laranja: 48h–7d
  - Vermelho: > 7d
- Ícone de relógio pequeno ao lado do tempo

**`src/components/leads/LeadColumn.tsx`** (se necessário)
- Ordenação opcional por urgência (leads mais antigos primeiro)

**Nenhuma alteração de banco** — usa `updated_at` que já existe na tabela `leads`.

---

### Feature 2: Resumo automático de conversas

**O que faz**: Botão "Resumir conversa" no painel lateral do chat. Chama a IA para gerar um resumo de 3-5 linhas do histórico.

**Alterações**:

**`src/components/chat/LeadSidePanel.tsx`**
- Novo botão "Resumir conversa" com ícone de documento
- Ao clicar, busca últimas 50 mensagens do `whatsapp_messages`
- Chama edge function para gerar resumo via Lovable AI
- Exibe resumo em card colapsável no painel

**Nova edge function `supabase/functions/summarize-conversation/index.ts`**
- Recebe `remoteJid`, `instanceName`, `workspaceId`
- Busca mensagens recentes de `whatsapp_messages`
- Chama Lovable AI (gemini-2.5-flash) com prompt: "Resuma esta conversa de WhatsApp em 3-5 linhas, em português, destacando: assunto principal, interesse do cliente, último pedido"
- Retorna texto do resumo

---

### Feature 3: Botão de ação rápida (1 clique)

**O que faz**: Botão contextual no card do Kanban e no header do chat que sugere a ação mais provável.

**`src/components/leads/LeadCard.tsx`**
- Botão pequeno no rodapé do card (ex: "Enviar follow-up", "Mover etapa", "Abrir chat")
- Lógica contextual:
  - Se lead sem resposta > 24h → "Enviar follow-up"
  - Se lead tem whatsapp_jid → "Abrir chat"
  - Se lead está há muito tempo na etapa → "Mover para próxima"

**`src/pages/Chats.tsx`** (header do chat)
- Botão de ação rápida ao lado do nome do contato
- Ações: "Mover etapa", "Adicionar tag", "Agendar follow-up"

---

### Feature 4: Classificação de leads com IA (Lead Scoring)

**O que faz**: Score 0-100 com badge visual (Quente/Morno/Frio) calculado pela IA baseado em engajamento.

**Migração SQL**:
- Adicionar colunas em `leads`: `ai_score integer default null`, `ai_score_label text default null`, `ai_scored_at timestamptz default null`

**Nova edge function `supabase/functions/score-lead/index.ts`**
- Analisa: quantidade de mensagens, tempo de resposta, menções a preço/compra, movimentações no funil
- Chama Lovable AI para classificar 0-100
- Atualiza `leads.ai_score`, `ai_score_label` (quente/morno/frio)

**`src/components/leads/LeadCard.tsx`**
- Badge colorido: 🔥 Quente (70-100), 🟡 Morno (30-69), 🔵 Frio (0-29)

**`src/components/leads/LeadFilters.tsx`**
- Filtro por classificação (Quente/Morno/Frio)

---

### Vou começar implementando a Feature 1 (Contador de tempo + prioridade visual).

