
# Plano: Agentes de IA Conversacionais para CRM Inboxia

## Visao Geral

Implementar um sistema completo de agentes de IA que permita criar, configurar e gerenciar assistentes virtuais inteligentes para atendimento, pre-qualificacao de leads, agendamentos, cobrancas e follow-up automatico via WhatsApp.

Os agentes serao baseados na arquitetura robusta dos seus workflows n8n existentes, mas integrados nativamente ao CRM com interface visual de configuracao.

---

## Analise dos Seus Workflows n8n

Com base nos arquivos enviados, identifiquei os seguintes padroes e funcionalidades:

### Agentes Mapeados

| Agente | Funcao Principal | Tecnologias |
|--------|------------------|-------------|
| AgenteMktBoost | SDR para clinicas odontologicas (pre-venda AUTOMATIC) | OpenAI GPT-4.1, Postgres Memory, Redis, Evolution API |
| Teg_Monitor_PT-Agente-SDR | SDR para servicos tecnicos (eletrica/manutencao) | OpenAI GPT-4.1, Postgres Memory, Supabase |
| Agente_Social_Brasil | Multi-atendimento generico | OpenAI GPT-4.1, Redis cache, mensagens picotadas |
| AgenteMultiatendimento | Atendimento multi-canal | OpenAI GPT-4.1, controle de pausa/reativacao |
| FERRAMENTA_DE_AGENDAMENTO | Sub-workflow de agendamento | Google Calendar (criar, cancelar, reagendar) |

### Capacidades Comuns Identificadas

1. **Memoria de Conversa**: Postgres Chat Memory por telefone (session_id)
2. **Divisao Inteligente de Mensagens**: Parser Chain que divide respostas longas em 300-500 caracteres
3. **Suporte Multimidia**: Processamento de texto, audio (Whisper), imagens (GPT-4o Vision)
4. **Pausa/Reativacao**: Codigo "251213" para pausar IA e "Atendimento finalizado" para reativar
5. **Gerente de Setor**: IA secundaria que analisa conversa e roteia para SUPORTE ou VENDAS
6. **Ferramentas Externas**: Agendamento Google Calendar, webhook n8n, update de leads

---

## Arquitetura Proposta

```text
+-------------------------------------------------------------------+
|                       CRM INBOXIA (Frontend)                      |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+  +-------------------+  +------------------+ |
|  | Galeria de       |  | Builder de        |  | Configuracao    | |
|  | Templates        |  | Agente IA         |  | de Agente       | |
|  | (Pre-definidos)  |  | (Prompt + Tools)  |  | (Triggers)      | |
|  +--------+---------+  +---------+---------+  +--------+---------+ |
|           |                      |                     |          |
+-----------+----------------------+---------------------+----------+
            |                      |                     |
            v                      v                     v
+-------------------------------------------------------------------+
|                    LOVABLE CLOUD (Backend)                        |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+  +-------------------+  +------------------+ |
|  | ai-agent-chat    |  | ai-agent-tools    |  | ai-agent-       | |
|  | Edge Function    |  | Edge Function     |  | scheduler       | |
|  | (Conversa IA)    |  | (Calendar, etc)   |  | Edge Function   | |
|  +--------+---------+  +---------+---------+  +--------+---------+ |
|           |                      |                     |          |
|           +----------+-----------+---------------------+          |
|                      |                                            |
|                      v                                            |
|           +----------+----------+                                 |
|           |   Supabase DB       |                                 |
|           | - ai_agents         |                                 |
|           | - agent_memories    |                                 |
|           | - agent_executions  |                                 |
|           +---------------------+                                 |
|                                                                   |
+-------------------------------------------------------------------+
            |
            v (via webhook reverso)
+-------------------------------------------------------------------+
|                       N8N (VPS Coolify)                           |
+-------------------------------------------------------------------+
|                                                                   |
|  Workflows existentes disponiveis como "tools" para os agentes   |
|  - FERRAMENTA_DE_AGENDAMENTO -> Tool: criar_reuniao              |
|  - Webhooks customizados -> Tool: executar_workflow              |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## Modelo de Dados

### Tabela: ai_agents

```sql
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'sdr', -- sdr, support, scheduler, collector, custom
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'openai/gpt-5-mini',
  temperature DECIMAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  tools JSONB DEFAULT '[]', -- Array de tools habilitadas
  trigger_config JSONB DEFAULT '{}', -- Quando ativar o agente
  fallback_config JSONB DEFAULT '{}', -- O que fazer se falhar
  pause_code TEXT DEFAULT '251213',
  resume_keyword TEXT DEFAULT 'Atendimento finalizado',
  message_split_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index para busca por tipo
CREATE INDEX idx_ai_agents_type ON ai_agents(type);
```

### Tabela: agent_memories

```sql
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- telefone do lead
  messages JSONB NOT NULL DEFAULT '[]', -- Array de {role, content, timestamp}
  summary TEXT, -- Resumo gerado periodicamente
  context_window INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, session_id)
);

-- Index para busca rapida
CREATE INDEX idx_agent_memories_session ON agent_memories(agent_id, session_id);
```

### Tabela: agent_executions

```sql
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  session_id TEXT NOT NULL,
  input_message TEXT NOT NULL,
  output_message TEXT,
  tools_used JSONB DEFAULT '[]',
  tokens_used INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, error, paused
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- Index para analytics
CREATE INDEX idx_agent_executions_agent ON agent_executions(agent_id, executed_at DESC);
```

---

## Tipos de Agentes (Templates)

### 1. Agente SDR / Pre-Qualificacao

**Objetivo**: Responder leads rapidamente, qualificar interesse e coletar informacoes basicas.

**Prompt Base**:
```
Voce e um assistente de vendas da empresa [NOME]. Seu objetivo e:
1. Responder rapidamente as mensagens
2. Identificar o que o lead precisa
3. Coletar nome, email e telefone
4. Classificar urgencia (baixa, media, alta)
5. Encaminhar para humano quando necessario (envie codigo: 251213)

Regras:
- Seja cordial e objetivo
- Faca uma pergunta por vez
- Nunca invente informacoes
- Use a tool 'atualizar_lead' para salvar dados coletados
```

**Tools Habilitadas**:
- `atualizar_lead` - Salvar dados no CRM
- `aplicar_tag` - Classificar lead
- `mover_etapa` - Mover no funil
- `pausar_ia` - Encaminhar para humano

### 2. Agente de Agendamento

**Objetivo**: Marcar, cancelar e reagendar reunioes automaticamente.

**Prompt Base**:
```
Voce e um assistente de agendamento da empresa [NOME]. Seu objetivo e:
1. Identificar se o cliente quer agendar, cancelar ou reagendar
2. Coletar nome, email e data/horario desejado
3. Verificar disponibilidade
4. Confirmar agendamento e enviar link da reuniao

Regras:
- Sempre confirme a data no formato DD/MM/YYYY HH:MM
- Reunioes duram 50 minutos por padrao
- Envie link do Google Meet apos confirmar
```

**Tools Habilitadas**:
- `criar_reuniao` - Cria evento no Google Calendar
- `cancelar_reuniao` - Remove evento
- `reagendar_reuniao` - Atualiza evento
- `verificar_disponibilidade` - Checa horarios livres

### 3. Agente de Follow-up

**Objetivo**: Reativar leads inativos e manter engajamento.

**Prompt Base**:
```
Voce e um assistente de reativacao da empresa [NOME]. Seu objetivo e:
1. Retomar contato com leads que pararam de responder
2. Oferecer ajuda ou novas informacoes
3. Identificar objecoes e tentar contorna-las
4. Registrar motivos de nao-interesse

Regras:
- Seja gentil e nao insistente
- Maximo 3 tentativas de follow-up
- Aguarde 24h entre cada tentativa
```

**Tools Habilitadas**:
- `atualizar_lead` - Registrar feedback
- `agendar_followup` - Programar proxima mensagem
- `mover_etapa` - Atualizar status

### 4. Agente de Cobranca

**Objetivo**: Enviar lembretes de pagamento e negociar.

**Prompt Base**:
```
Voce e um assistente de cobrancas da empresa [NOME]. Seu objetivo e:
1. Lembrar sobre faturas em aberto
2. Enviar segunda via de boleto
3. Oferecer opcoes de parcelamento
4. Registrar acordos ou recusas

Regras:
- Seja respeitoso e profissional
- Nunca ameace ou pressione
- Oferecer link de pagamento quando disponivel
```

**Tools Habilitadas**:
- `enviar_boleto` - Gera e envia boleto
- `registrar_acordo` - Salva negociacao
- `atualizar_lead` - Atualizar status de pagamento

---

## Edge Functions Necessarias

### 1. ai-agent-chat

Funcao principal que processa mensagens e gera respostas usando IA.

**Responsabilidades**:
- Receber mensagem do lead
- Buscar memoria da conversa
- Chamar modelo de IA (Lovable AI ou OpenAI)
- Executar tools se necessario
- Dividir mensagem longa em partes
- Salvar no historico
- Retornar resposta

### 2. ai-agent-tools

Funcao que implementa as tools disponiveis para os agentes.

**Tools Implementadas**:
- `atualizar_lead` - PATCH na tabela leads
- `aplicar_tag` - INSERT na lead_tag_assignments
- `mover_etapa` - UPDATE leads.stage_id
- `enviar_mensagem` - POST na Evolution API
- `chamar_n8n` - POST no webhook do n8n

### 3. ai-agent-scheduler

Funcao que gerencia mensagens agendadas e follow-ups.

**Responsabilidades**:
- Verificar mensagens pendentes
- Executar follow-ups no horario
- Respeitar intervalos minimos

---

## Interface do Usuario

### 1. Tela de Listagem (AIAgents.tsx atualizada)

- Cards com estatisticas por agente
- Conversas ativas, taxa de resolucao, tempo medio
- Toggle para ativar/pausar agente
- Acesso rapido ao builder

### 2. Tela de Criacao/Edicao

**Wizard em 4 Etapas**:

1. **Tipo de Agente**: Escolher template ou criar personalizado
2. **Configuracao Basica**: Nome, descricao, modelo de IA
3. **Prompt e Comportamento**: System prompt, temperatura, pausar/reativar
4. **Tools e Gatilhos**: Habilitar tools, definir quando ativar

### 3. Tela de Teste

- Simulador de conversa para testar agente
- Selecionar lead existente ou criar ficticio
- Ver logs de execucao em tempo real

---

## Integracao com n8n

### Opcao A: Via Webhooks (Recomendada)

O CRM envia dados para n8n quando o agente precisa executar uma acao complexa.

**Fluxo**:
1. Agente decide chamar tool `criar_reuniao`
2. Edge Function envia POST para n8n webhook
3. n8n executa FERRAMENTA_DE_AGENDAMENTO
4. n8n retorna resultado via callback
5. Agente continua conversa com confirmacao

### Opcao B: Via MCP (Avancada)

Conectar n8n ao Lovable via MCP para executar workflows diretamente.

---

## Fases de Implementacao

### Fase 1: Fundacao (Semana 1)

- [ ] Criar tabelas ai_agents, agent_memories, agent_executions
- [ ] Implementar Edge Function ai-agent-chat basica
- [ ] Integrar com Lovable AI (openai/gpt-5-mini)
- [ ] Atualizar pagina AIAgents.tsx para listar agentes do banco

### Fase 2: Builder Visual (Semana 2)

- [ ] Criar AIAgentBuilder.tsx com wizard de 4 etapas
- [ ] Implementar editor de prompt com variaveis
- [ ] Adicionar configuracao de tools
- [ ] Criar tela de teste/simulacao

### Fase 3: Tools e Integracao (Semana 3)

- [ ] Implementar Edge Function ai-agent-tools
- [ ] Conectar com Evolution API para envio de mensagens
- [ ] Criar webhook reverso para n8n
- [ ] Implementar tool de agendamento

### Fase 4: Follow-up e Scheduler (Semana 4)

- [ ] Implementar Edge Function ai-agent-scheduler
- [ ] Criar sistema de filas de mensagens
- [ ] Adicionar regras de intervalo e retry
- [ ] Dashboard de execucoes e logs

---

## Diferenciais vs Workflows n8n

| Aspecto | n8n (Atual) | CRM Inboxia (Proposta) |
|---------|-------------|------------------------|
| Interface | Tecnica (nodes) | Visual amigavel |
| Manutencao | Requer conhecimento | Auto-explicativo |
| Historico | Separado por workflow | Centralizado por lead |
| Metricas | Manual | Dashboard automatico |
| Custo | VPS + manutencao | Incluso no CRM |
| Escala | Limitado por RAM | Serverless |

---

## Proximos Passos

1. **Imediato**: Aprovar este plano para iniciar implementacao
2. **Configurar**: Secret para OPENAI_API_KEY (opcional, Lovable AI funciona sem)
3. **Conectar**: n8n via webhook para FERRAMENTA_DE_AGENDAMENTO
4. **Testar**: Criar primeiro agente SDR e validar com lead real

