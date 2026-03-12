

## Diagnóstico: Campanhas WABA não disparam

### Causa raiz confirmada

Os templates usam **variáveis nomeadas** (`{{customer_name}}` com `param_name: "customer_name"`), mas o código envia os parâmetros **sem o campo `name`**.

O payload atual gera:
```json
{ "type": "text", "text": "João" }
```

A Meta exige para variáveis nomeadas:
```json
{ "type": "text", "parameter_name": "customer_name", "text": "João" }
```

Isso causa o erro `"Parameter name is missing or empty"` em **100% dos envios** (329 falhas em cada campanha, 0 sucessos).

### Correção

Editar **`supabase/functions/process-campaigns/index.ts`**, linha 199.

Ao construir `bodyParams`, detectar se o template usa variáveis nomeadas (tem `param_name` no `example`) e incluir `parameter_name` no payload:

1. Extrair o mapa de `param_name` dos `body_text_named_params` do componente BODY
2. Ao fazer push em `bodyParams`, adicionar `parameter_name` quando disponível
3. Manter compatibilidade com templates que usam variáveis numeradas (`{{1}}`, `{{2}}`)

Mudança localizada em ~10 linhas, sem impacto no restante do sistema.

### Após o deploy

As campanhas estão pausadas. Basta:
1. Reenviar as falhas (o botão "Reenviar falhas" já reseta os recipients para `pending`)
2. Ou retomar as campanhas no horário de envio (07:00-19:00)

