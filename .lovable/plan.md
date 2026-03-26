

## Corrigir: Agente executa ferramentas não habilitadas (calendário e outras)

### Problema
Quando o agente tem ferramentas selecionadas (ex: Atualizar Lead, Aplicar Tag, Mover Etapa, Pausar IA), a filtragem funciona. Porém há dois problemas:

1. **Agentes com `tools: []` (vazio)**: A função `getToolDefinitions` retorna TODAS as ferramentas (linha 248: `if enabledTools.length === 0 return allTools`). Isso faz com que o modelo receba ferramentas que não foram habilitadas.

2. **Sem guarda na execução**: Mesmo que a ferramenta não esteja habilitada no agente, se o modelo a chamar (por contexto do prompt ou alucinação), o código executa sem verificar se a ferramenta está na lista `agent.tools`.

No seu caso específico: a Iara tem 4 ferramentas marcadas e `gerenciar_calendario` desmarcado, então a filtragem do OpenAI tools funciona. **Mas** se o modelo "alucinar" e tentar chamar a tool mesmo sem recebê-la (raro mas possível), não há bloqueio na execução.

### Correção

**Arquivo**: `supabase/functions/ai-agent-chat/index.ts`

**1. Corrigir `getToolDefinitions` (linha 248)**
- Remover o fallback que retorna todas as ferramentas quando a lista está vazia
- Se `enabledTools` está vazio, retornar array vazio (nenhuma ferramenta)
- Isso garante que agentes sem nenhuma ferramenta marcada não recebam nada

**2. Adicionar guarda na execução de cada tool call (bloco de processamento ~linha 1000+)**
- Antes de executar qualquer tool call, verificar: `if (!enabledTools.includes(toolName))` → pular execução e retornar mensagem genérica
- Isso impede execução mesmo que o modelo tente chamar uma ferramenta não habilitada

### Resultado
- Agente com `gerenciar_calendario` desmarcado: modelo NÃO recebe a definição da tool E a execução é bloqueada como segurança extra
- Agente com `tools: []`: nenhuma ferramenta é enviada ao modelo
- Nenhuma outra lógica é alterada (prompts, personalidade, FAQ, knowledge, etc.)

