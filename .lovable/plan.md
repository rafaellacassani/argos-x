

## Correção: Links duplicados nas respostas da IA no WhatsApp

### Problema
A IA responde com links em formato Markdown (`[texto](url)`), mas o WhatsApp não renderiza Markdown de links. O resultado é o usuário ver algo como:

> Acesse www.site.com.br/pagina www.site.com.br/pagina

### Causa
Não existe nenhuma sanitização de Markdown antes de enviar o texto via Evolution API. O texto sai direto da IA para o WhatsApp.

### Solução
Adicionar uma função `stripMarkdownLinks(text)` que converte `[texto](url)` → `url` (mantém apenas a URL) em **2 arquivos**:

1. **`supabase/functions/whatsapp-webhook/index.ts`** — aplicar antes de enviar cada chunk/response (linhas ~1214 e ~1276)
2. **`supabase/functions/check-missed-messages/index.ts`** — aplicar antes de enviar cada chunk/response (linhas ~265-267 e ~287-289)

### Função de sanitização
```typescript
function stripMarkdownLinks(text: string): string {
  // [texto](url) → url
  return text.replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '$2');
}
```

### Onde aplicar
- Em `whatsapp-webhook`: antes de `sendWithFallback("sendText", { text: cleanText })` — aplicar `stripMarkdownLinks(cleanText)`
- Em `check-missed-messages`: antes de cada `evolutionFetch(.../sendText/...)` — aplicar `stripMarkdownLinks(chunk)` e `stripMarkdownLinks(agentData.response)`

### Impacto
- Correção pontual, sem efeito colateral
- Afeta apenas o texto enviado ao WhatsApp, não a memória/banco

