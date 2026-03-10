

## Janela de 24h da Cloud API nos Agentes de IA

### Contexto
A WhatsApp Cloud API (Meta) exige que mensagens proativas (fora de resposta) sejam enviadas dentro de uma janela de 24h após a última mensagem do cliente. Atualmente o agente não tem controle sobre isso -- ele responde e faz follow-up sem restrição.

### Plano

#### 1. Nova coluna no banco -- `cloud_24h_window_only`
- Adicionar `cloud_24h_window_only BOOLEAN DEFAULT true` na tabela `ai_agents`
- Quando `true`: agente só responde/envia follow-up se a última mensagem do cliente foi há menos de 24h
- Quando `false`: agente responde livremente (útil para Evolution API ou se o workspace tem templates aprovados)

#### 2. Frontend -- BehaviorTab.tsx
- Mostrar a opção **condicionalmente** apenas quando a instância selecionada é Cloud API (valor começa com `cloud_`) ou "Todas as instâncias" (e há conexões Cloud API)
- UI: Switch com label "Respeitar janela de 24h (Cloud API)" e descrição explicando que a Meta limita envios fora dessa janela
- Posicionar logo abaixo do seletor de instância WhatsApp

#### 3. Backend -- facebook-webhook/index.ts
- Na função `routeToAIAgent`, antes de chamar o agente, verificar:
  - Se `agent.cloud_24h_window_only === true`
  - Buscar o timestamp da última mensagem inbound do sender na `meta_conversations`
  - Se > 24h, não enviar (logar skip)
- Aplicar a mesma lógica no follow-up automático (quando `check-no-response-alerts` tenta enviar via Cloud API)

#### 4. Hook/Types -- useAIAgents.ts
- Adicionar `cloud_24h_window_only` ao `CreateAgentData` interface e ao payload de `createAgent`

### Arquivos alterados
- **Migration SQL**: adicionar coluna `cloud_24h_window_only`
- **`src/components/agents/tabs/BehaviorTab.tsx`**: switch condicional
- **`src/hooks/useAIAgents.ts`**: novo campo no create/interface
- **`supabase/functions/facebook-webhook/index.ts`**: verificação de janela 24h
- **`supabase/functions/check-no-response-alerts/index.ts`**: verificação de janela 24h no follow-up

