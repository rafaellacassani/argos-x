

## Problema Identificado

A IA está vazando notas internas para o cliente. Isso acontece porque o código **concatena metadados internos diretamente no `responseContent`** — a mesma string que é enviada ao WhatsApp.

Há **4 pontos** no `ai-agent-chat/index.ts` onde isso acontece:

1. **Linha 1482** — `pausar_ia`: adiciona `[Atendimento transferido para humano. Motivo: ...]`
2. **Linha 1566** — calendário (conflito): adiciona `[INSTRUÇÃO INTERNA: Este horário já está ocupado...]`
3. **Linha 1676** — calendário (reagendar conflito): adiciona `[INSTRUÇÃO INTERNA: Este horário já está ocupado...]`
4. **Linha 1814** — calendário (slots ocupados): adiciona `[INSTRUÇÃO INTERNA - Horários indisponíveis...]`

## Correção

**Arquivo: `supabase/functions/ai-agent-chat/index.ts`**

### 1. `pausar_ia` (linha 1482)
- **Remover** a concatenação de `[Atendimento transferido para humano...]` no `responseContent`
- A informação do motivo já está sendo salva no `human_support_queue.reason` (linha 1489), então nenhum dado é perdido
- O `responseContent` deve conter apenas a despedida natural da IA (que ela já gera no próprio texto da resposta)

### 2. Instruções de calendário (linhas 1566, 1676, 1814)
- **Mover** essas instruções para uma variável separada (ex: `internalNotes`) que é adicionada apenas ao array `messages` (memória interna do agente) mas **NÃO** ao `responseContent`/`finalResponse` enviado ao cliente
- Isso permite que a IA "lembre" da instrução na próxima interação sem expor ao lead

### 3. Sanitização final (safety net)
- Antes de montar `finalResponse` (linha 1885), aplicar uma regex para remover qualquer padrão `[INSTRUÇÃO INTERNA...` ou `[Atendimento transferido...` residual:
  ```
  responseContent = responseContent.replace(/\n*\[(?:INSTRUÇÃO INTERNA|Atendimento transferido)[^\]]*\]/g, '').trim()
  ```
- Isso serve como rede de segurança caso a IA gere esses padrões espontaneamente

### Fluxo corrigido

```text
Antes:  responseContent = "Resposta da IA" + "[INSTRUÇÃO INTERNA: ...]"
                          ↓ enviado ao cliente via WhatsApp

Depois: responseContent = "Resposta da IA"  → enviado ao cliente
        internalNotes = "[INSTRUÇÃO INTERNA: ...]"  → salvo apenas na memória
```

Nenhum outro arquivo será alterado.

