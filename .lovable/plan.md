

# Diagnóstico e Correção: Follow-up Inteligente

## Problemas Encontrados (dados reais do banco)

### 1. Campanhas ECX travadas como "running" para sempre
- **Campanha `2697b5c8`**: Status "running", 710 contatos marcados, **0 contatos inseridos no banco**, 0 enviados. A campanha foi criada no browser mas o loop morreu antes de inserir os contatos. Como não existe mecanismo de recuperação, ela ficará "running" eternamente.

### 2. Edge Function retornando erro genérico
- **Campanha `e665d24c`**: 4 contatos com erro `"Edge Function returned a non-2xx status code"`. O erro real da função é engolido pelo `supabase.functions.invoke` — o frontend não consegue distinguir se foi erro de IA, de envio, ou timeout.

### 3. Execução 100% client-side (causa raiz principal)
O loop inteiro de geração + envio roda no **browser do usuário**. Se fechar a aba, perder internet, ou o computador dormir, a campanha morre silenciosamente com status "running" e sem cleanup.

### 4. Scan sem paginação pode dar timeout
A query de scan carrega **TODAS** as `meta_conversations` ou `whatsapp_messages` de um workspace de uma vez. Com 1.500+ registros na ECX funciona, mas com workspaces maiores vai dar timeout na edge function.

### 5. Sem detecção de campanhas abandonadas
Não existe lógica para detectar que uma campanha está "running" há horas sem progresso e marcá-la como abandonada.

---

## Plano de Correção

### Correção 1: Melhorar tratamento de erros no hook (useFollowupCampaigns.ts)

**O que muda**: Quando `supabase.functions.invoke` retorna erro, extrair a mensagem real do `data.error` ao invés do genérico do wrapper.

```
Antes: throw new Error(genData?.error || genError?.message || 'AI generation failed');
Depois: extrair genError.context?.body se disponível, ou o response text
```

### Correção 2: Adicionar auto-cleanup de campanhas "running" abandonadas (useFollowupCampaigns.ts)

**O que muda**: Ao carregar campanhas, se alguma está "running" há mais de 30 minutos sem progresso (updated_at desatualizado), marcar automaticamente como "canceled" com nota "abandonada por inatividade".

### Correção 3: Proteger contra falha na inserção de contatos (useFollowupCampaigns.ts)

**O que muda**: Se a inserção de contatos falhar, reverter o status da campanha para "canceled" ao invés de deixar "running" sem contatos. Adicionar try/catch granular.

### Correção 4: Adicionar paginação na query de scan (followup-inteligente/index.ts)

**O que muda**: As queries de `meta_conversations` e `whatsapp_messages` no action `scan` terão `.limit(5000)` para evitar timeouts, e a mensagem mais recente por contato será considerada (já funciona assim pelo ORDER DESC).

### Correção 5: Melhorar robustez da execução contra erros intermitentes (useFollowupCampaigns.ts)

**O que muda**: 
- Adicionar retry automático (1x) quando o erro for timeout/rede
- Se 5 erros consecutivos ocorrerem, pausar automaticamente a campanha com toast avisando o usuário
- Logar o erro real no console para debugging

### Correção 6: Adicionar validação de instância antes de iniciar (followup-inteligente/index.ts)

**O que muda**: Na action `send`, se a instância WABA não for encontrada ou a Evolution API não responder, retornar erro claro ao invés de 500 genérico.

---

## Arquivos modificados
1. `src/hooks/useFollowupCampaigns.ts` — Correções 1, 2, 3 e 5
2. `supabase/functions/followup-inteligente/index.ts` — Correções 4 e 6

## Resultado
- Campanhas não ficarão mais travadas como "running" eternamente
- Erros reais serão visíveis no log de execução
- Falhas intermitentes terão retry automático
- 5 falhas consecutivas = pausa automática com aviso
- Scan não vai dar timeout em workspaces grandes

