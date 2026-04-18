

## Estado da Aria (agente de suporte do widget)

### Está funcionando? **Sim, parcialmente — mas com limitações importantes.**

**O que ela faz hoje (`support-chat` edge function):**
- Roda no widget de "Suporte" (ícone de fone) acessível pelo sidebar
- Usa **GPT-4o-mini** (OpenAI direto) com fallback para `gpt-5-nano` via Lovable AI
- Tem um **system prompt gigante** (400 linhas) cobrindo praticamente toda a documentação: planos, conexões WhatsApp/WABA, agentes IA, chat, funil, contatos, calendário, salesbot, campanhas, templates
- Streaming SSE no chat (resposta em tempo real)
- **Escalation para humano**: detecta palavras-chave (`humano`, `atendente`, `falar com pessoa`...) → cria ticket em `support_tickets` e notifica via WhatsApp configurado no workspace

**Pontos fortes:**
- Cobertura de conteúdo é boa — sabe responder navegação, preços, planos, como criar agente, conectar WhatsApp, etc.
- Markdown bem formatado no widget (`SupportChatWindow` renderiza com `react-markdown`)
- Realtime: quando atendente responde no painel, aparece no chat do cliente

**Limitações reais (bugs/gaps):**

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **Não tem acesso aos dados do workspace** — diferente da `workspace-assistant`, ela não consulta leads, agentes, instâncias do cliente. Só responde teoria. | Não consegue responder "minha IA está respondendo?" ou "quantos leads recebi hoje?" |
| 2 | **System prompt estático** — não sabe o plano nem o nome do cliente que está perguntando | Pode sugerir features que o plano não tem (ex: API no Essencial) |
| 3 | **Tickets escalados nunca são auto-atribuídos à Isabella** (regra que existe pra outros caminhos de suporte) — todos os 93 tickets `open` estão `assigned_to=NULL` | Cliente abre ticket pelo widget e ninguém é notificado no painel admin |
| 4 | **Modelo fraco (gpt-4o-mini/nano)** vs Iara/Aria do WhatsApp que usam GPT-5 | Respostas menos precisas em casos complexos |
| 5 | **Sem histórico persistente** — cada sessão começa do zero, mensagens não são salvas em `support_messages` exceto quando escala | Cliente não vê conversas anteriores, suporte humano não vê o que a IA já tentou |
| 6 | **Sem ferramentas (tools)** — não consegue executar nada (ex: testar conexão, ver status de instância, abrir doc) | É puramente conversacional |

**Veredicto prático:** Ela responde dúvidas **conceituais e de navegação** bem (90% das perguntas comuns: "como conecto WhatsApp", "qual plano tenho", "como crio campanha"). Mas trava em qualquer dúvida que precise olhar **dados do cliente** ("por que minha IA não respondeu fulano?") — nesses casos ela só consegue escalar para humano, e o ticket fica órfão sem responsável.

### Se quiser deixá-la "boa de verdade", recomendo (não fazer agora, só listar):

1. Atribuir tickets escalados automaticamente à Isabella (já é regra documentada na memory)
2. Subir modelo para GPT-5-mini (gateway Lovable, sem custo extra de API key)
3. Dar acesso ao contexto do workspace (plano, nome, métricas básicas) — copiar lógica de `workspace-assistant`
4. Persistir todas as mensagens em `support_messages` (não só escalações)
5. Adicionar tools mínimas: `verificar_status_instancia`, `verificar_meu_plano`, `listar_meus_agentes`
6. Adicionar atalho no header do widget mostrando: "Falar com humano"

