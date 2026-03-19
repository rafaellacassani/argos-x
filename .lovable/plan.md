

## Diagnóstico: Filtro "Sem resposta" em conversas WABA

### O que encontrei

**Os filtros estão funcionando corretamente no código.** O problema é de dados e volume:

1. **Limite de 100 conversas**: A consulta ao banco carrega apenas as 100 conversas mais recentes (`LIMIT 100`). Das ~6.109 conversas WABA, só 100 são exibidas.

2. **Das 100 carregadas, 97 são outbound (campanha) e apenas 3 são inbound** (respostas de leads). Ao clicar "Sem resposta", a lista passa de 100 para 3 conversas — se você não percebeu a mudança, pode parecer que não funcionou.

3. **265 respostas existem no banco** — pessoas responderam sim, mas estão "escondidas" porque o limite de 100 prioriza as mais recentes (que são os envios da campanha).

### O que será corrigido

**1. Remover o limite fixo de 100 para WABA e carregar todas as conversas**
- Ou aumentar o limite para 5000+ para cobrir o volume das campanhas

**2. Adicionar paginação inteligente no summary view**
- Ao ativar o filtro "Sem resposta", buscar do banco apenas conversas com `direction = 'inbound'` (server-side filter), em vez de filtrar client-side nos 100 carregados

**3. Feedback visual claro**
- Mostrar contagem de resultados: ex. "3 conversas sem resposta"
- Se o filtro reduzir a lista dramaticamente, garantir que o empty state fique visível

### Detalhes técnicos

```text
Problema atual:
  meta_conversation_summary → LIMIT 100 → 97 outbound + 3 inbound
  Filtro "sem resposta" client-side → mostra só 3

Solução:
  1. useMetaChat.fetchConversations() → remover .limit(100) ou aumentar
  2. Adicionar parâmetro de filtro server-side para direction
  3. fetchConversations(metaPageId, { directionFilter: 'inbound' })
     → .eq('direction', 'inbound') quando filtro ativo
```

**Arquivos a modificar:**
- `src/hooks/useMetaChat.ts` — aumentar limite, adicionar filtro server-side por direction
- `src/pages/Chats.tsx` — passar filtro de direction ao carregar conversas WABA, adicionar contagem visual

