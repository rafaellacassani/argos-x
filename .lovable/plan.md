
## Correção definitiva do “Interceptar / Retornar IA” em Chats

### O que está quebrado hoje
Achei a causa principal da inconsistência:

1. **O botão Interceptar hoje faz operações soltas no cliente**
   - pausa `agent_memories` por `lead_id`
   - tenta descobrir `session_id`
   - cria item em `human_support_queue`
   - mas **não cria ticket de suporte**
   - e **não existe uma operação única/atômica** para garantir que tudo fique sincronizado

2. **A pausa atual depende de existir `agent_memories`**
   - se a conversa ainda não tiver memória criada, o “pausar” não bloqueia futuras respostas
   - depois, quando entra nova mensagem, a IA pode criar nova memória e responder mesmo “interceptada”

3. **A IA não usa a fila humana como trava oficial**
   - `ai-agent-chat` só olha `memory.is_paused`
   - ele **não consulta `human_support_queue`**
   - então a conversa pode estar em atendimento humano e mesmo assim a IA voltar

4. **Suporte e fila estão desconectados**
   - hoje `human_support_queue` e `support_tickets` são fluxos separados
   - por isso não existe “abrir ticket ao interceptar” nem “encerrar ticket ao retornar IA”

---

## Correção proposta
Vou transformar a interceptação em um fluxo único e confiável, com **uma fonte oficial de verdade**:

### 1) Criar um handoff humano centralizado no backend
Criar uma backend function dedicada para dois comandos:
- `intercept`
- `resume`

Ela será responsável por:
- identificar a conversa corretamente (`session_id` determinístico)
- pausar a IA
- cancelar follow-ups pendentes
- criar/reativar item da fila humana
- criar/reativar ticket de suporte
- ao retornar IA: resolver fila + encerrar ticket + reativar IA

Isso elimina o estado quebrado de múltiplas chamadas independentes no front.

---

### 2) Fazer a IA respeitar a interceptação antes de responder
Ajustar `ai-agent-chat` para consultar a fila humana **antes de continuar o processamento**.

Se houver item ativo (`waiting` ou `in_progress`) para:
- aquele `session_id`, ou
- aquele `lead_id`

então a função:
- não responde
- garante `is_paused = true` na memória existente, se houver
- retorna como “pausada”

Assim a IA para de depender apenas de `agent_memories` e passa a obedecer o estado real do atendimento humano.

---

### 3) Ligar fila humana com ticket de suporte
Hoje falta vínculo entre os dois mundos. Vou adicionar isso.

#### Mudança de banco mínima
Adicionar `ticket_id` em `human_support_queue`.

Com isso:
- cada interceptação fica ligada ao ticket correspondente
- “Retornar IA” fecha exatamente o ticket certo
- o painel de suporte consegue refletir o mesmo atendimento

Também vou prever proteção contra duplicidade de interceptação ativa para a mesma conversa.

---

### 4) Ajustar a UI do Chats
Na tela de Chats:

#### Quando **não** estiver interceptado:
- mostrar botão **Interceptar**

#### Quando **estiver** interceptado:
- esconder/substituir por botão **Retornar IA**
- manter a barra visual de “Em atendimento humano”

#### Ao clicar em **Interceptar**:
- chamar a nova backend function
- abrir ticket automaticamente
- colocar na fila
- pausar IA imediatamente

#### Ao clicar em **Retornar IA**:
- chamar a mesma backend function no modo `resume`
- encerrar ticket
- resolver fila
- reativar IA

---

### 5) Sincronizar também o painel de suporte
Para ficar realmente definitivo, vou sincronizar o outro lado também:

- se o ticket for assumido no suporte, o item da fila vira `in_progress`
- se o ticket for marcado como resolvido/fechado no suporte, a fila é resolvida e a IA volta

Assim não fica mais possível o chat estar “aberto” num lugar e “fechado” em outro.

---

## Arquivos/áreas que entram no escopo
### Frontend
- `src/pages/Chats.tsx`
- `src/hooks/useHumanSupportQueue.ts`
- `src/pages/SupportAdmin.tsx`

### Backend
- `supabase/functions/ai-agent-chat/index.ts`
- nova backend function para handoff humano/interceptação

### Banco
- migration para `human_support_queue`:
  - adicionar `ticket_id`
  - opcionalmente índice/garantia para evitar duplicatas ativas da mesma conversa

---

## Resultado esperado
Depois dessa correção, o comportamento ficará assim:

```text
Interceptar
→ IA pausa de verdade
→ follow-ups daquela conversa param
→ ticket de suporte é aberto
→ conversa entra na fila humana
→ botão vira “Retornar IA”

Retornar IA
→ fila é encerrada
→ ticket é encerrado
→ IA volta a poder responder naquela conversa
→ botão volta para “Interceptar”
```

---

## Detalhes técnicos importantes
- Vou usar **`session_id` como chave principal da conversa** sempre que possível:
  - Evolution: JID da conversa
  - WABA: padrão `waba_<telefone>`
- O bloqueio da IA será validado no backend, não só na interface
- A retomada da IA **não vai recriar follow-ups cancelados automaticamente**; ela volta a responder às próximas mensagens, que é o comportamento mais seguro
- O escopo fica focado apenas no fluxo de interceptação/handoff humano, sem mexer nas demais automações fora disso

---

## Ordem de implementação
1. Migration com vínculo `human_support_queue.ticket_id`
2. Backend function única de `intercept/resume`
3. Guarda definitiva em `ai-agent-chat`
4. Ajuste do botão e fluxo em `Chats`
5. Sincronização com `SupportAdmin`

