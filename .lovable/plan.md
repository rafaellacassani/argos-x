

## Correções: Mensagens agendadas + Follow-up

### Item 4: Mensagens agendadas com `@lid` sem phone_number

**Problema:** A função `send-scheduled-messages` recebe mensagens com `remote_jid` no formato `@lid` (identificador interno do WhatsApp). Quando o campo `phone_number` está vazio, a função tenta usar o número do `@lid` como telefone, o que falha porque `@lid` não é um número real.

Das 5 falhas recentes:
- 2 foram por instância desconectada (não é bug — o cliente precisa reconectar)
- 2 foram por `@lid` sem `phone_number` (bug no código)
- 1 por instância desconectada de outro cliente

**Solução:** No `send-scheduled-messages`, quando `remote_jid` é `@lid` e `phone_number` está vazio:
1. Buscar o lead correspondente na tabela `leads` pelo `remote_jid` (campo `whatsapp_jid`) ou pelo `instance_name` + workspace
2. Usar o `phone` do lead como número de envio
3. Se ainda não encontrar, buscar na tabela `whatsapp_messages` a última mensagem daquele JID para extrair o número real

**Arquivo:** `supabase/functions/send-scheduled-messages/index.ts` — linhas 55-64

### Item 5: Follow-up inteligente — SEM AÇÃO necessária

Diagnóstico concluído:
- A função `followup-inteligente` não precisa de cron — ela é acionada pelo frontend (aba de campanhas de Follow-up Inteligente)
- Os 163 pendentes na `agent_followup_queue` pertencem ao **follow-up automático da IA** dos agentes, processado pelo cron `check-no-response-alerts` (a cada 5 min)
- Os logs confirmam execução normal: `[followup-queue] Processed: 1`, `✅ Follow-up sent`
- Os pendentes têm `execute_at` no futuro e serão processados quando chegar a hora

Nenhuma correção necessária para o item 5.

### Resumo
- **1 arquivo alterado:** `supabase/functions/send-scheduled-messages/index.ts`
- **Impacto:** Mensagens agendadas para contatos com `@lid` sem phone_number passarão a buscar o número real do lead antes de enviar

