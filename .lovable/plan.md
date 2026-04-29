## Diagnóstico — Pet Sonhos / Jéssica Rosa

**Atenção ao número:** o cliente informou `21974807486`, mas o contato real no sistema é **Jéssica Rosa — `5521974807586`** (8 e não 4 antes do 6). Confirmei pelas mensagens.

### Linha do tempo da conversa
1. **11:36** — "Oi" → IA respondeu "Oi, sou a Maria Sofia da PET SONHOS. Você tem um pet?" ✅
2. **11:39** — "Sim" → IA respondeu "Que tipo de pet você tem?" ✅
3. **11:44** — "Cachorro" → IA respondeu "Qual a idade do seu cachorro?" ✅
4. **12:01:07** — "17 anos" → **IA não respondeu** ❌
5. **12:01:30** — "Qual o valor do banho e tosa?" → **IA não respondeu** ❌
6. **16:21** — Lead enviou um cartão de contato (vCard) → sem resposta
7. **18:17** — Lead enviou link do site da Argos X (parece spam/teste) → sem resposta
8. **18:20** — "Eu te avisei" → sem resposta

### Causa raiz
- A `agent_memories` da Jéssica está com `last_message_id = 3AE958B2C413C3444AB5` (o "Cachorro" das 11:44).
- Não existe NENHUM `agent_executions` registrado depois das 11:44 — ou seja, a IA **nunca foi chamada** para as mensagens das 12:01 em diante.
- Não há linha em `webhook_message_log` faltando: o webhook recebeu e registrou as 8 mensagens normalmente.
- Não há ticket de suporte humano, não há followup pendente, agente não está pausado, nem em processamento travado, nem media_handoff ativo.
- **Conclusão:** o webhook entregou as mensagens mas a chamada para `ai-agent-chat` foi descartada/perdida silenciosamente entre 12:01 e agora. Provavelmente bloqueada por dedup com `last_message_id` antigo, ou por falha pontual na invocação interna sem retry.

### Plano de ação

1. **Recuperar a conversa da Jéssica imediatamente**
   - Limpar `last_message_id` da `agent_memories` dela (para liberar dedup)
   - Disparar a função `argosx-catchup` (ou `reprocess-missed-leads`) com a última mensagem inbound dela (`"Qual o valor do banho e tosa?"`) para que a IA responda agora
   - Ignorar o vCard das 16:21 e o link das 18:17 (são ruído — não são pergunta legítima)

2. **Varredura geral de outras conversas no mesmo estado**
   - Rodar `reprocess-missed-leads` em modo `dry_run` cobrindo as últimas 24h em todos os workspaces para detectar quantas conversas estão com inbound não respondido depois de uma assistant question
   - Listar quais workspaces foram afetados
   - Executar a recuperação real (sem dry_run) para todos

3. **Correção preventiva no `whatsapp-webhook` / `ai-agent-chat`**
   - Adicionar um log de erro mais loud quando a invocação da `ai-agent-chat` retorna `skipped` por motivos não-óbvios (dedup, lock, janela 24h, etc.) com o `session_id` e `message_id` no log
   - Garantir que o cron de `reprocess-missed-leads` rode pelo menos a cada 15 min (verificar se já está agendado e em qual frequência) para que falhas pontuais sejam recuperadas automaticamente em < 15 min sem intervenção manual

4. **Avisar o cliente Pet Sonhos**
   - O número correto é `5521974807586` (Jéssica Rosa), não `21974807486`
   - A IA já vai retomar a conversa após a recuperação
   - Os "anexos" (vCard e link) que ela mandou foram ignorados de propósito (a IA não responde mídia por padrão dele)

### Detalhes técnicos
- Workspace: `6b099930-a6fa-4f1a-aa1c-220a30b60de5` (Pet Sonhos)
- Agente: `2d5bada0-c011-4962-9e6d-5399746e924c` (Maria, gpt-4o-mini, ativo, instance `6b099930-atendikent`)
- Sessão: `5521974807586@s.whatsapp.net`
- Lead: `a7c6b329-e680-4a81-a807-a604173fd132` (Jéssica Rosa, fase "Leads de Entrada")
- `agent_memories.id`: `8eee1796-58f4-47fe-9a62-38c6a48cb459`
- `respond_to=all`, `media_handoff_enabled=false`, `followup_enabled=true`, sem followup agendado

Posso executar?