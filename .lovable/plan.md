

# Diagnóstico — Agente da Rosana (Instituto Método SIC) "trava e para de responder"

## O que encontrei no banco

**Workspace:** `Instituto método SIC` (`968f07cf-b48e-4697-9c6b-1457a8645094`) — plano `active`, sem bloqueio.
**Agente:** `Morfeu` (`5510150a-f234-4a7b-8588-8e7e8c28abcb`).
**Instância WhatsApp:** `968f07cf-instituto-m-todo-sic` (Evolution).

## Causas reais — em ordem de impacto

### 1. **O agente `Morfeu` está DESATIVADO** (`is_active = false`) 🔴 raiz do problema
Não é "travamento" — está desligado. Por isso não responde ninguém. Foi atualizado pela última vez em **09/abr** e desde então `is_active=false`.

Evidência reforçando:
- **Última execução do agente: 09/abr/2026 18:02** (34 execuções no total, todas até essa data).
- **Zero mensagens WhatsApp nos últimos 7 dias** na instância (`whatsapp_messages` vazia no período) — combinando com instância possivelmente desconectada também.
- Há 4 memórias de sessão antigas, **2 ainda marcadas como `is_paused=true`** (de 09/abr e 20/abr) — mesmo que ela reative o agente, esses 2 leads específicos continuam pausados até reset manual.

### 2. **Modelo configurado é `openai/gpt-5`** (premium) com `temperature 0.5` e `response_delay_seconds = -1`
- `gpt-5` no plano `active` (Essencial/Negócio) gera custo alto e latência maior — não é a causa do "travamento", mas vai voltar a queimar tokens rápido quando reativar.
- `response_delay_seconds = -1` é um valor não-padrão (UI normalmente usa 0/30/60/120). Pode estar sendo interpretado como "delay infinito" em algum caminho — preciso confirmar olhando `ai-agent-chat`.

### 3. **Instância WhatsApp pode estar desconectada**
Zero mensagens em 7d numa conta `active` é forte sinal de instância caída na Evolution. Precisa validar o estado real chamando `evolution-api`.

## O que vou fazer (ordem de execução)

1. **Reativar o agente Morfeu** (`is_active=true`) via update SQL — destrava 100% do fluxo.
2. **Resetar `is_paused=false`** nas 2 memórias travadas (`5527996542806` e `5521986124103`) e zerar `is_processing` em qualquer memória presa (não há nenhuma agora, mas confirmo).
3. **Trocar modelo `gpt-5` → `openai/gpt-4o-mini`** (recomendado oficial, mesma qualidade para SDR, custo ~10x menor) — evita estouro de tokens/custo quando ela reativar o volume.
4. **Normalizar `response_delay_seconds`** de `-1` para `0` (resposta imediata, padrão).
5. **Verificar estado da instância Evolution** `968f07cf-instituto-m-todo-sic` chamando `connection-state` — se estiver `close`, abrir QR code para ela reconectar (vou só diagnosticar e te avisar — reconectar precisa ser ela escaneando).
6. **Checar logs do `ai-agent-chat`** para o agente nos últimos dias a fim de confirmar se não há erro silencioso (timeout, prompt malformado, tool quebrada) que tenha originalmente desativado o agente.

## O que NÃO vou mexer
- Conteúdo do system prompt / personalidade.
- Configurações de follow-up, qualificação, FAQ, conexões.
- Departamentos / roteamento.

## Como confirmar com a Rosana depois do fix
Pedir para ela mandar uma mensagem de teste no número conectado. Espero ver:
- Mensagem aparece em `whatsapp_messages`.
- Execução nova em `agent_executions` em <30s.
- Resposta enviada na Evolution.

## Detalhes técnicos

- Updates SQL: `UPDATE ai_agents SET is_active=true, model='openai/gpt-4o-mini', response_delay_seconds=0 WHERE id='5510150a...'` + `UPDATE agent_memories SET is_paused=false, is_processing=false WHERE workspace_id='968f07cf...' AND is_paused=true`.
- Diagnóstico instância: `supabase functions invoke evolution-api → /connection-state/968f07cf-instituto-m-todo-sic`.
- Logs: `edge_function_logs` para `ai-agent-chat` filtrando `968f07cf` ou `5510150a`.

## Observação sobre o discurso da cliente
A cliente diz "trava no meio do atendimento". O dado real mostra que o agente **parou de operar há quase 2 semanas** (último uso 09/abr) e está desligado. Provavelmente alguém (ela ou um membro) clicou em "desativar" e esqueceu, ou o sistema desativou após algum erro/limite — vou conferir nos logs se há trace de auto-desativação. De qualquer forma, depois de reativado e validado, comunicar a ela com clareza: "o agente estava desativado, reativamos e ajustamos o modelo para a versão recomendada".

