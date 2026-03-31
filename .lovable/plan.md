

## Plano de Correção: Botões de Chat (Bloquear/Desbloquear, Pausar/Retomar IA, Interceptar/Retomar)

### Problemas identificados

**1. Bloquear/Desbloquear contato — erro 404 na Evolution API**
- O endpoint `/message/updateBlockStatus/{instance}` retorna 404
- O fallback `/chat/updateBlockStatus/{instance}` retorna 500
- Isso é um bug conhecido da Evolution API v2 (issue #2225 no GitHub)
- A API aceita a rota com prefixo diferente dependendo da versão do server
- Além disso, ambos os botões "Bloquear" e "Desbloquear" aparecem sempre simultaneamente — deveria mostrar só "Bloquear" normalmente e "Desbloquear" somente se o lead estiver bloqueado/opted-out

**2. "Pausar IA" (3 pontinhos) não tem botão "Retomar IA" correspondente**
- O botão "Pausar IA" seta `is_paused = true` no `agent_memories` e cancela follow-ups
- Porém NÃO existe opção "Retomar IA" no mesmo menu para desfazer isso
- O único "Retomar" existente é o do botão "Interceptar/Retornar IA" que depende da fila `human_support_queue`
- Resultado: quem pausa a IA pelo menu de 3 pontinhos nunca consegue retomar

**3. Interceptar/Retornar IA**
- O botão "Interceptar" funciona (cria ticket + pausa IA via `human-handoff`)
- O botão "Retornar IA" deveria aparecer quando há item ativo na fila — isso funciona
- Porém se a IA foi pausada pelo botão "Pausar IA" (sem ticket/fila), o botão "Retornar IA" não aparece porque não há `queue item`

---

### Correções propostas

#### A. Bloquear/Desbloquear — UI condicional + fix do endpoint

**Arquivo:** `src/pages/Chats.tsx` (linhas ~3180-3240)

1. Mostrar "Bloquear contato" apenas se o lead **não** está com `is_opted_out = true`
2. Mostrar "Desbloquear contato" apenas se o lead **está** com `is_opted_out = true`
3. Buscar o estado do lead (`is_opted_out`) ao renderizar o menu

**Arquivo:** `supabase/functions/evolution-api/index.ts` (linhas ~570-615)

4. Tentar endpoint adicional: `/chat/update/{instanceName}` com body `{ action: "block"/"unblock", number }` como fallback extra
5. Se todos os endpoints da Evolution API falharem, fazer apenas o bloqueio lógico no banco (marcar `is_opted_out` no lead) e mostrar sucesso ao usuário — o contato fica bloqueado na IA mesmo que a Evolution API não suporte

#### B. Pausar IA / Retomar IA — menu 3 pontinhos

**Arquivo:** `src/pages/Chats.tsx` (linhas ~3242-3272)

1. Verificar se o lead tem `is_paused = true` no `agent_memories`
2. Se IA **não pausada**: mostrar "Pausar IA" (comportamento atual)
3. Se IA **pausada** (e não interceptada pela fila): mostrar "Retomar IA" que faz:
   - `update agent_memories set is_paused = false where lead_id = X and workspace_id = Y`
   - Toast de confirmação
4. Carregar o estado `is_paused` do lead selecionado via query ao `agent_memories`

#### C. Interceptar / Retornar IA — já funciona

O botão Interceptar/Retornar IA depende da `human_support_queue` e está correto. A confusão é que "Pausar IA" do menu de 3 pontinhos não cria item na fila, então o "Retornar IA" do interceptar não aparece.

Com a correção B, haverá o "Retomar IA" no menu de 3 pontinhos para esse caso.

---

### Resumo de alterações

| Arquivo | O que muda |
|---|---|
| `src/pages/Chats.tsx` | Menu 3 pontinhos: bloquear/desbloquear condicional; pausar/retomar IA condicional; query de estado do lead |
| `supabase/functions/evolution-api/index.ts` | Fallback adicional no block endpoint; aceitar "bloqueio lógico" se API falhar |

### Impacto
- Sem efeito colateral nas demais funcionalidades
- Bloquear/desbloquear funciona mesmo se a Evolution API não suportar o endpoint
- Pausar/Retomar IA via menu funciona independentemente da fila de suporte

