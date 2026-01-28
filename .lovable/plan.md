

# 🔧 Configurar Webhook do Facebook/Instagram

## Resumo

Vou criar a edge function `facebook-webhook` que irá validar o webhook da Meta usando o token de verificação `inboxia-verification`.

---

## O que será feito

### 1. Criar Edge Function `facebook-webhook`

A função terá dois endpoints principais:

- **GET** - Validação do webhook (challenge verification)
  - Verifica se `hub.verify_token` é igual a `inboxia-verification`
  - Retorna o `hub.challenge` para confirmar a URL

- **POST** - Recebimento de eventos em tempo real
  - Recebe mensagens, comentários, etc.
  - Prepara estrutura para processar eventos futuros

### 2. Fluxo de Verificação da Meta

```
Meta envia GET com:
├── hub.mode = "subscribe"
├── hub.verify_token = "inboxia-verification"
└── hub.challenge = "12345..."

Se token válido:
└── Retorna: 12345... (o challenge)

Se token inválido:
└── Retorna: 403 Forbidden
```

---

## Detalhes Técnicos

### Estrutura da Edge Function

**Arquivo:** `supabase/functions/facebook-webhook/index.ts`

A função usará Hono para routing e terá:

1. **Verificação (GET)**
   - Extrai `hub.mode`, `hub.verify_token`, `hub.challenge` da query string
   - Compara token com valor hardcoded `inboxia-verification`
   - Retorna `challenge` como texto puro (não JSON)

2. **Recebimento de eventos (POST)**
   - Recebe payload JSON da Meta
   - Loga eventos no console para debug
   - Retorna 200 OK imediatamente (requisito da Meta)

3. **CORS e OPTIONS**
   - Headers padrão para permitir requisições

### Atualização do config.toml

Adicionar configuração para desabilitar verificação JWT (webhook é público):

```toml
[functions.facebook-webhook]
verify_jwt = false
```

---

## Resultado Esperado

Após a implementação:

1. ✅ A URL `https://qczmdbqwpshioooncpjd.supabase.co/functions/v1/facebook-webhook` responderá corretamente
2. ✅ A verificação do webhook no Facebook Developers passará
3. ✅ Eventos de mensagens/comentários serão recebidos e logados

---

## Próximos Passos (após esta implementação)

1. Adicionar secrets do Facebook App (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`)
2. Criar tabelas no banco para armazenar contas e mensagens
3. Implementar OAuth para login com Facebook
4. Processar eventos recebidos e salvar no banco
5. Integrar mensagens do Meta no Chat unificado

