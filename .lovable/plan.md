
## Correção definitiva do `stripe-webhook` (erro 400 / “Invalid signature”)

### Diagnóstico
Revisei a função `supabase/functions/stripe-webhook/index.ts` e confirmei que ela **já lê o body bruto com `await req.text()` antes da validação**, então esse não é mais o problema.

O ponto mais provável é outro:

1. A função usa `stripe.webhooks.constructEvent(...)` **síncrono**
2. Em runtime Edge/Deno com Web Crypto, isso pode falhar e cair no mesmo `catch`
3. O código então responde genericamente com:
   ```json
   { "error": "Invalid signature" }
   ```
4. Isso mascara a causa real e faz parecer que o secret está errado mesmo quando o problema pode ser o método de validação usado no runtime

Além disso, hoje a função:
- não diferencia “secret ausente” de “assinatura inválida”
- não registra contexto suficiente para depuração
- provavelmente está recebendo eventos live corretamente, mas falhando na verificação dentro do runtime

### O que vou alterar
#### 1) Ajustar a validação do webhook para o padrão compatível com Edge runtime
No arquivo `supabase/functions/stripe-webhook/index.ts`:

- manter `const rawBody = await req.text()`
- manter `const signature = req.headers.get("stripe-signature")`
- trocar:
  ```ts
  stripe.webhooks.constructEvent(...)
  ```
  por:
  ```ts
  await stripe.webhooks.constructEventAsync(...)
  ```
Isso é a correção mais importante para eliminar a falha recorrente em runtime Web Crypto.

#### 2) Melhorar a robustez da validação
Também vou:
- validar explicitamente se `STRIPE_WEBHOOK_SECRET` existe
- responder com erro claro se o secret não estiver carregado
- separar melhor os cenários:
  - assinatura ausente
  - secret ausente
  - validação Stripe falhou
  - erro interno de processamento

#### 3) Melhorar logs sem expor segredos
Vou incluir logs seguros com:
- tipo do evento quando validado
- presença/ausência do header `stripe-signature`
- tamanho do body
- mensagem real do erro de verificação

Sem logar:
- secret
- payload sensível completo
- assinatura completa

Isso ajuda a distinguir:
- secret incorreto
- endpoint errado no Stripe
- incompatibilidade do runtime
- outro erro interno

#### 4) Forçar novo deploy da função
Como haverá mudança real no arquivo, o deploy será refeito automaticamente e a função passará a carregar:
- o secret já atualizado
- a nova lógica de validação assíncrona

### Arquivo que será alterado
- `supabase/functions/stripe-webhook/index.ts`

### O que não será alterado
- nenhuma tabela do banco
- nenhum fluxo de checkout
- nenhuma tela do app
- nenhuma outra edge function

### Resultado esperado
Após a correção:
- os webhooks do Stripe devem parar de retornar `400 Invalid signature` por erro do runtime
- eventos como `customer.subscription.created`, `customer.subscription.updated` e `invoice.payment_succeeded` devem ser aceitos normalmente
- se ainda houver falha, os logs passarão a mostrar a causa real com muito mais precisão

### Observação importante
Se mesmo após isso continuar dando 400, aí o problema remanescente passa a ser quase certamente externo ao código:
- signing secret de outro endpoint no Stripe
- endpoint live/test diferente
- webhook apontando para URL diferente da função atual

Mas hoje, pelo código lido, a correção mais forte e objetiva é migrar a verificação para `constructEventAsync(...)` e melhorar a telemetria do handler.
