

## Implementar consulta de site/e-commerce nos Agentes de IA (Plano Escala)

### Resumo

Quando o agente tiver um `website_url` configurado e o workspace for plano Escala, o sistema usará Firecrawl para extrair o conteúdo do site e injetá-lo no contexto da IA. Isso permite que a IA responda perguntas sobre produtos, preços e estoque automaticamente.

### Pré-requisito

Conectar o **Firecrawl** como connector do projeto para obter a `FIRECRAWL_API_KEY` nas edge functions.

### Arquivos e mudanças

#### 1. Migração de banco — adicionar cache de conteúdo

Adicionar 2 colunas em `ai_agents`:
- `website_content TEXT` — conteúdo scraped em markdown
- `website_scraped_at TIMESTAMPTZ` — timestamp do último scrape

#### 2. Nova edge function: `scrape-agent-website/index.ts`

- Recebe `{ agent_id }`, verifica se workspace é plano Escala
- Busca `website_url` do agente
- Chama Firecrawl `/v1/scrape` com `formats: ['markdown']`, `onlyMainContent: true`
- Trunca o markdown para ~8000 chars (limite de contexto)
- Salva em `ai_agents.website_content` e `website_scraped_at`
- Retorna sucesso com preview do conteúdo

#### 3. Modificar `ai-agent-chat/index.ts`

Na função `buildKnowledgeBlock`:
- Se `agent.website_content` existir, adicionar bloco:
  ```
  INFORMAÇÕES DO SITE/E-COMMERCE:
  {agent.website_content}
  ```
- Isso é injetado automaticamente no prompt sem queries extras

#### 4. Modificar `AttachmentsTab.tsx`

- Importar `useWorkspace` para checar plano
- Se plano NÃO for Escala: mostrar o campo website com cadeado e tooltip "Disponível no plano Escala"
- Se plano for Escala: mostrar campo + botão "Sincronizar site" que chama `scrape-agent-website`
- Mostrar badge com data do último sync quando houver

#### 5. Modificar `AgentDetailDialog.tsx`

No `handleSave`, se `website_url` mudou e plano é Escala, disparar scrape automático após salvar.

### Fluxo

```text
1. Usuário Escala configura website_url no agente
2. Ao salvar → chama scrape-agent-website → Firecrawl extrai markdown
3. Conteúdo salvo em ai_agents.website_content
4. Quando lead pergunta sobre produto/preço → ai-agent-chat injeta website_content no prompt
5. IA responde com dados reais do site
6. Botão "Sincronizar" permite re-scrape manual
```

### Limites e segurança

- Conteúdo truncado em 8000 chars para não estourar contexto
- Re-scrape apenas a cada 6 horas (cooldown)
- Somente plano Escala tem acesso (verificação no backend e no frontend)
- Firecrawl key nunca exposta ao cliente

