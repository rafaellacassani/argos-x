

# Busca Global no Conteúdo das Conversas

## O que muda

Hoje a busca no chat filtra apenas por **nome** e **telefone** do contato. A proposta é adicionar busca por **conteúdo das mensagens** — como funciona no WhatsApp, onde você digita um termo e ele encontra conversas que contêm aquele texto.

## Como vai funcionar

1. Quando o usuário digita um termo de busca (mínimo 3 caracteres), além do filtro local por nome/telefone, o sistema faz uma **consulta no banco de dados** na tabela `whatsapp_messages` buscando mensagens cujo `content` contém o termo (case-insensitive).

2. Os resultados trazem os `remote_jid` distintos que possuem mensagens com aquele termo, ordenados pela mensagem mais recente.

3. Esses resultados são **mesclados** com o filtro local — conversas que já aparecem por nome/telefone ficam no topo, e conversas encontradas apenas pelo conteúdo da mensagem são adicionadas à lista.

4. Um indicador visual mostra quando a busca está acontecendo no servidor (loading) e quantos resultados vieram do conteúdo.

5. A busca também inclui a tabela `meta_conversations` para cobrir mensagens do Facebook/Instagram.

## Plano técnico

| Arquivo | Mudança |
|---|---|
| `src/pages/Chats.tsx` | Adicionar estado `contentSearchResults`, lógica de debounce (500ms) para buscar `whatsapp_messages` e `meta_conversations` por `content ilike %termo%`, mesclar resultados no `filteredChats`. Adicionar indicador de loading na busca. |

### Detalhes da query

```sql
-- WhatsApp messages: buscar remote_jids com conteúdo matching
SELECT DISTINCT remote_jid, instance_name, MAX(timestamp) as last_match
FROM whatsapp_messages
WHERE workspace_id = ? AND content ILIKE '%termo%'
GROUP BY remote_jid, instance_name
ORDER BY last_match DESC
LIMIT 50

-- Meta conversations: buscar sender_ids com conteúdo matching  
SELECT DISTINCT sender_id, meta_page_id, MAX(timestamp) as last_match
FROM meta_conversations
WHERE workspace_id = ? AND content ILIKE '%termo%'
GROUP BY sender_id, meta_page_id
ORDER BY last_match DESC
LIMIT 50
```

### Fluxo no frontend

1. Debounce de 500ms no `searchTerm` (só dispara para 3+ chars)
2. Executa as 2 queries em paralelo via `supabase.from(...)`
3. Mapeia os `remote_jid` / `sender_id` retornados para os chats já carregados
4. Chats que existem na lista local são priorizados; os que não existem recebem um badge "Encontrado por conteúdo"
5. Quando o usuário limpa a busca, volta ao comportamento normal

Nenhuma mudança de banco de dados necessária — as tabelas já existem com os campos corretos.

