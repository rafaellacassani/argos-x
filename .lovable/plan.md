

## Problema Identificado

A IA do Follow-up Inteligente está enviando placeholders como `[Nome]` no chat porque:

1. **O system prompt não menciona o nome do contato** — a IA recebe o histórico mas não sabe o nome real da pessoa, então inventa um placeholder `[Nome]`
2. **As regras de validação não detectam placeholders** — `FOLLOWUP_LEAK_RULES` não tem regex para `[Nome]`, `[nome]`, `{nome}`, `#nome#`, etc.
3. **O prompt não proíbe explicitamente o uso de placeholders**

## Correções (todas no arquivo `supabase/functions/followup-inteligente/index.ts`)

### 1. Adicionar regras de detecção de placeholders

Novas regras em `FOLLOWUP_LEAK_RULES`:

```
/\[nome\]/i → "placeholder [Nome] detectado"
/\[name\]/i → "placeholder [Name] detectado"  
/\{nome\}/i → "placeholder {nome} detectado"
/#nome#/i → "placeholder #nome# detectado"
/\[.*?(nome|name|telefone|email|empresa).*?\]/i → "placeholder genérico detectado"
```

### 2. Passar o nome real do contato no prompt

Na action `generate` (linha ~458), buscar o nome do contato e incluí-lo no system prompt:

- Usar `contact_name` do body da request (já disponível no scan)
- Se não houver nome: instruir a IA explicitamente "O contato NÃO tem nome registrado. NÃO use placeholders como [Nome] — inicie a conversa sem usar o nome."
- Se houver nome: "O nome do contato é: João. Use naturalmente."

### 3. Atualizar o hook para enviar o nome

No `useFollowupCampaigns.ts`, passar `contact_name: contact.name` no body da chamada `generate`.

### 4. Reforçar no system prompt

Adicionar instrução explícita:
> "NUNCA use placeholders como [Nome], [nome], {nome}, #nome# ou qualquer variável entre colchetes/chaves. Se não souber o nome, NÃO use o nome — fale de forma genérica."

### Arquivos modificados
1. `supabase/functions/followup-inteligente/index.ts` — regras de validação + system prompt + receber nome
2. `src/hooks/useFollowupCampaigns.ts` — enviar `contact_name` na chamada generate

### Resultado
- Placeholders como `[Nome]` serão bloqueados automaticamente (não serão enviados)
- A IA saberá o nome real ou saberá que não tem nome e agirá adequadamente
- Aplica a **todos os workspaces**, não apenas master

