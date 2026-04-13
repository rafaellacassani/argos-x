

# Correção: Remover `form_name` da query Graph API no facebook-webhook

## Problema confirmado
A Graph API v21.0 retorna erro 400 `"(#100) Tried accessing nonexisting field (form_name)"` na linha 793, bloqueando toda criação de leads via Meta Lead Ads.

## 3 Mudanças (todas em `supabase/functions/facebook-webhook/index.ts`)

### Mudança 1 — Linha 793: Remover `form_name` da query
```
fields=field_data,ad_id,ad_name,campaign_id,campaign_name,form_id
```

### Mudança 2 — Após linha 801: Buscar form_name separadamente
Adicionar bloco que faz `GET /{form_id}?fields=name` em try/catch. Se falhar, `formName = null` sem bloquear o fluxo.

### Mudança 3 — Linhas 886 e 939: Substituir `leadData.form_name` por `formName`
Usar a variável do fallback nas referências de notas e histórico.

### Deploy
Deploy automático da edge function `facebook-webhook` após as mudanças.

