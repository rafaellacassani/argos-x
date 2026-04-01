

## Refatoração do Wizard de Criação de Agentes de IA

### Resumo
Transformar o wizard de 5 passos em 8 passos completos, eliminando a necessidade de editar o agente logo após criá-lo. Linguagem ultra-simples em português. Nenhuma alteração no banco de dados necessária.

### Confirmações de segurança
- Todos os campos novos no wizard já existem na tabela `ai_agents` como nullable com defaults seguros
- Zero impacto em agentes já criados — apenas o fluxo de criação muda
- `AgentDetailDialog.tsx` (edição) não será alterado

### Novo fluxo de 8 passos

| Passo | Título simplificado | Campos |
|---|---|---|
| 1 | "O que sua IA vai fazer?" | Nome, objetivo principal |
| 2 | "Sobre sua empresa" | Nome da empresa, nicho, site |
| 3 | "Como a IA deve se comportar?" | Tom de voz, cargo, delay de resposta, emojis |
| 4 | "O que a IA precisa saber?" | Produtos/serviços, regras, informações extras (textareas com placeholders didáticos) |
| 5 | "Mensagem de boas-vindas" | Campo opcional para saudação inicial (com explicação: "Se não preencher, a IA vai cumprimentar automaticamente") |
| 6 | "Reengajar quem não respondeu" | Toggle ativar follow-up + sequência simples (delay em horas + mensagem) com explicação curta |
| 7 | "Conectar ao WhatsApp" | Dropdown de instâncias existentes + botão "Conectar novo número" que abre o ConnectionModal com QR Code |
| 8 | "Tudo pronto! Revisar e ativar" | Resumo visual + switch "Ativar agora" (pré-ligado) + aviso "Você pode pausar a qualquer momento" |

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/agents/CreateAgentDialog.tsx` | Refatorar de 5 para 8 passos, adicionar estados para knowledge, greeting, followup, connection. Integrar `ConnectionModal` no passo 7. |
| `src/hooks/useAIAgents.ts` | Atualizar `CreateAgentData` interface para incluir `greeting_message` e garantir que todos os novos campos são mapeados na mutação `createAgent` |

### Detalhes de implementação

- **Passo 4 (Conhecimento)**: 3 textareas — "Produtos e serviços", "Regras da IA", "Informações extras". Placeholders com exemplos reais em português
- **Passo 5 (Boas-vindas)**: Campo `greeting_message` será salvo em `on_start_actions` como `[{ type: "send_message", message: "..." }]` (formato já suportado pelo backend)
- **Passo 6 (Follow-up)**: Toggle + lista simples de mensagens com delay. Texto explicativo: "Se o cliente parar de responder, a IA envia mensagens automáticas para reengajar"
- **Passo 7 (Conexão)**: Query de `whatsapp_instances` via Evolution API (já existe no código atual). Botão "Conectar novo número" abre `ConnectionModal` inline
- **Passo 8 (Ativação)**: `is_active` default `true`. Toast de sucesso: "IA criada e ativada! Você pode testar ou pausar a qualquer momento no painel"
- **Após criar**: Não abre mais o `AgentDetailDialog` automaticamente — o agente já está completo

### O que NÃO muda
- `AgentDetailDialog.tsx` e todas as abas de edição
- Tabela `ai_agents` no banco
- Edge function `ai-agent-chat`
- Qualquer agente já existente

