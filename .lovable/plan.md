

## Corrigir visibilidade do Lead Scoring e Resumo de Conversa

### Problema 1: Classificar IA (Lead Scoring)
O botão "Classificar IA" foi adicionado ao `LeadDetailSheet.tsx`, mas a página de Funil (`Leads.tsx`) usa `LeadDetailModal.tsx`. O modal **não tem** nenhum botão de scoring.

### Problema 2: Resumo de Conversa
O botão "Resumir conversa" existe em `LeadSidePanel.tsx`, mas só aparece quando há um lead vinculado ao chat. Quando o contato não tem lead, o componente retorna na linha 325 (mostra "Criar Lead") e nunca chega à seção de resumo. Precisamos mostrar o resumo mesmo sem lead, pois o `chatContact` já tem `remoteJid`.

### Correções

**1. `src/components/leads/LeadDetailModal.tsx`**
- Adicionar botão "Classificar IA" / "Reclassificar" no header do modal
- Importar `supabase`, `Brain`, `Loader2`, `Flame`, `Sun`, `Snowflake`, `cn`
- Adicionar estado `isScoring` e função `handleScoreLead` (invocar `score-lead`)
- Mostrar badge de score (Quente/Morno/Frio) quando disponível
- Chamar `onUpdate` para persistir o score no lead

**2. `src/components/chat/LeadSidePanel.tsx`**
- Mover a seção "Resumo IA" para **dentro** da view de "sem lead" também (antes do "Criar Lead")
- Quando `lead` é null mas `chatContact` existe, mostrar o botão "Resumir conversa" usando `chatContact.remoteJid` e `chatContact.instanceName`
- A função `handleSummarize` já suporta isso (linha 172: `lead?.whatsapp_jid || chatContact?.remoteJid`)

### Arquivos alterados
| Arquivo | Mudança |
|---|---|
| `src/components/leads/LeadDetailModal.tsx` | Adicionar botão + badge de scoring IA |
| `src/components/chat/LeadSidePanel.tsx` | Mostrar resumo IA mesmo sem lead vinculado |

### O que NÃO será alterado
- Nenhuma edge function, nenhuma tabela, nenhuma outra página

