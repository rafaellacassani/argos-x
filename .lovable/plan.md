

## Diagnóstico — IAs do Argos X não respondendo

### O que está acontecendo (causa raiz)

Existem **5 tickets de suporte humano abertos** no Argos X que estão **sem `lead_id` ou sem `session_id` específico**, mas o código do `ai-agent-chat` faz a checagem assim:

```ts
// linha 848: 
if (!humanQueueActive && lead_id) {
  // busca em human_support_queue por lead_id
}
```

Olhando os tickets abertos:
| Ticket | lead_id | Razão | Criado |
|--------|---------|-------|--------|
| #127 | **NULL** | manual | hoje 14:41 |
| #126 | ef1d593d... | ai_loop | hoje 14:26 |
| #121 | **NULL** | pausar_ia | ontem 19:24 |
| #117 | **NULL** | manual | ontem |
| #109 | **NULL** | pausar_ia | ontem |

**Por enquanto a checagem está OK** (filtra por lead_id quando o ticket tem lead_id). Mas vejo nos logs **DEZENAS de leads diferentes** sendo bloqueados pelo "Human support queue active" agora. Isso indica que algo está marcando `lead_id` em tickets ou está casando errado.

Olhando o log de mensagens pausadas (>20 sessões diferentes pausadas nas últimas 2h), e o ticket #126 do **ef1d593d** que entrou em loop — esse lead específico está bloqueado **corretamente** (loop detectado).

**O verdadeiro problema:** os tickets #127 e #121 com `lead_id=NULL` e `session_id=NULL` provavelmente têm campo errado ou a lógica está casando algo a mais. Preciso verificar a coluna `session_id` desses tickets e se algum trigger/automação está marcando todos os leads novos como "paused" pela migration de departamentos de ontem.

**Suspeita secundária (alta):** a migration de ontem (`ai_departments`) adicionou `claim_lead_agent` que pode estar setando `leads.active_agent_id` e algum fluxo está confundindo isso com "atendimento humano". Preciso confirmar.

### Plano de correção

**1. Investigação adicional (10s)**
- Verificar `session_id` dos tickets abertos
- Cruzar com os leads bloqueados nos logs para entender o match
- Confirmar se a tabela `agent_memories.is_paused=true` em massa veio da migration de ontem

**2. Correção do bug (se confirmado)**
- **Hipótese A — tickets antigos órfãos**: resolver/fechar tickets #109, #117, #121 (de ontem, abandonados sem lead_id) para liberar
- **Hipótese B — bug no guard**: se a query estiver retornando ticket de OUTRO lead por engano, ajustar a condição
- **Hipótese C — pause em massa pela migration**: rodar UPDATE liberando `is_paused=false` para sessões que NÃO têm ticket ativo correspondente

**3. Hot-fix imediato no `ai-agent-chat`**
- Adicionar log mostrando **qual ticket** está bloqueando (ID + lead_id) para futura debug
- Garantir que ticket com `lead_id=NULL` E `session_id=NULL` **não bloqueia ninguém** (ticket fantasma)

**4. Verificação**
- Forçar reprocessamento das mensagens perdidas via `reprocess-missed-leads`
- Confirmar nos logs que IA voltou a responder

### O que vou entregar

- Liberar imediatamente as conversas travadas
- Corrigir o guard para não bloquear leads por tickets órfãos
- Reprocessar as últimas 6h de mensagens não respondidas do Argos X
- Adicionar log diagnóstico para a próxima vez

<lov-actions>
<lov-suggestion message="Execute o plano: investigue, libere as conversas travadas, corrija o guard e reprocesse as mensagens perdidas das últimas 6h.">Executar correção completa</lov-suggestion>
<lov-suggestion message="Apenas libere as conversas travadas agora (resolver tickets órfãos + despausar memórias) e reprocesse as mensagens. A correção de código fazemos depois.">Só desbloquear agora</lov-suggestion>
<lov-suggestion message="Antes de qualquer ação, mostre exatamente quais conversas estão bloqueadas e por qual ticket, pra eu validar caso a caso.">Mostrar lista antes</lov-suggestion>
</lov-actions>
