

## Corrigir: Agente não consegue interpretar imagens (responde em inglês/sem sentido)

### Problema
Quando o lead envia uma imagem pela Evolution API, a IA responde em inglês com "I can see you've shared an image, but it appears to be a very large base64-encoded image file" — sem interpretar a imagem e sem seguir o treinamento.

### Causa raiz
Dois problemas em `supabase/functions/ai-agent-chat/index.ts`:

1. **Base64 possivelmente malformado**: A Evolution API pode retornar o base64 com prefixo `data:image/...;base64,` já incluso. O código adiciona outro prefixo (`data:${mimetype};base64,`), gerando URL duplicada/inválida
2. **Imagem muito grande**: Imagens de 2-4MB geram strings base64 de 3-5MB, que excedem o limite prático do modelo para visão. O modelo falha silenciosamente e "alucina" a resposta genérica em inglês

### Correção

**Arquivo**: `supabase/functions/ai-agent-chat/index.ts` (linhas ~741-752)

**1. Sanitizar o base64 antes de montar o data URL**
- Remover qualquer prefixo `data:...;base64,` que já venha da Evolution API
- Garantir que a string é base64 puro antes de construir o data URL

**2. Limitar tamanho da imagem**
- Se o base64 > 1.5MB (~1MB de imagem), não enviar como multimodal
- Em vez disso, enviar mensagem de texto informando à IA: `[O lead enviou uma imagem, mas ela é muito grande para análise. Responda normalmente com base no contexto da conversa.]`

**3. Fallback robusto se imagem falhar**
- Se o base64 estiver vazio ou inválido, não tentar enviar como multimodal
- Usar texto descritivo para a IA continuar a conversa normalmente

### O que NÃO será alterado
- Nenhum componente frontend
- Nenhuma tabela do banco
- Nenhuma lógica de áudio (já funciona)
- Nenhuma lógica de tools, calendário, personalidade
- O whatsapp-webhook e facebook-webhook permanecem iguais

### Resultado
- **Antes**: IA responde em inglês sem interpretar a imagem
- **Depois**: IA interpreta a imagem corretamente (se < 1.5MB) ou responde naturalmente informando que não conseguiu visualizar (se muito grande)

