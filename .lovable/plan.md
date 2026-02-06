

# Integração Meta (WhatsApp Business API) com o Chat

## Situação Atual

Após análise detalhada do código, identifiquei o seguinte cenário:

### O que funciona
- **WhatsApp via Evolution API (QR Code)**: Totalmente funcional -- o Chat recebe, exibe e envia mensagens via Evolution API
- **OAuth do Meta**: A edge function `facebook-oauth` troca códigos por tokens e salva nas tabelas `meta_accounts` e `meta_pages`
- **Webhook do Meta**: A edge function `facebook-webhook` recebe eventos da Meta, mas **apenas faz log** -- nao processa nem armazena as mensagens

### O problema principal
O webhook do Meta (`facebook-webhook`) **nao faz nada** com as mensagens recebidas. Ele apenas imprime no console e retorna 200. Nao ha:
- Armazenamento de mensagens recebidas via Meta
- Envio de respostas via Graph API do Facebook/Instagram
- Integracao das conversas Meta no modulo de Chat

---

## Plano de Implementacao

### 1. Criar tabela `meta_conversations` (banco de dados)

Tabela para armazenar conversas e mensagens recebidas/enviadas via Meta:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| meta_page_id | uuid | FK para meta_pages |
| platform | text | 'facebook', 'instagram', 'whatsapp_business' |
| sender_id | text | ID do remetente na plataforma Meta |
| sender_name | text | Nome do remetente |
| message_id | text | ID da mensagem na Meta (para deduplicacao) |
| content | text | Conteudo da mensagem |
| message_type | text | 'text', 'image', 'video', 'audio', 'sticker' |
| media_url | text | URL da midia (se aplicavel) |
| direction | text | 'inbound' ou 'outbound' |
| timestamp | timestamptz | Quando a mensagem foi enviada |
| raw_payload | jsonb | Payload original da Meta |
| created_at | timestamptz | Quando foi salvo |

### 2. Atualizar a Edge Function `facebook-webhook`

Transformar de "apenas log" para processamento real:

- **Parsear mensagens** de Facebook Messenger, Instagram DM e WhatsApp Business API
- **Salvar no banco** cada mensagem recebida na tabela `meta_conversations`
- **Identificar plataforma** (Facebook, Instagram, WhatsApp Business) automaticamente
- **Deduplicar** mensagens usando o `message_id` da Meta

### 3. Criar Edge Function `meta-send-message`

Nova edge function para enviar respostas via Graph API:

- Enviar mensagens de texto via Facebook Messenger
- Enviar mensagens de texto via Instagram DM
- Usar o `page_access_token` correto da tabela `meta_pages`
- Suportar diferentes tipos de conteudo (texto, imagem)

### 4. Atualizar o modulo de Chat (`Chats.tsx`)

Integrar as conversas Meta ao lado das conversas WhatsApp:

- Adicionar uma nova "fonte" de conversas alem do Evolution API
- No seletor de instancias, incluir opcoes para paginas Meta conectadas
- Carregar conversas da tabela `meta_conversations` agrupadas por `sender_id`
- Enviar respostas via a nova edge function `meta-send-message`
- Manter a opcao "Todos" unificando WhatsApp + Meta

### 5. Configurar Realtime

- Habilitar realtime na tabela `meta_conversations` para que novas mensagens aparecam instantaneamente no Chat

---

## Detalhes Tecnicos

### Fluxo de Mensagem Recebida (Meta)

```text
Meta Platform --> Webhook (facebook-webhook)
                    |
                    v
              Parsear evento
                    |
                    v
          Salvar em meta_conversations
                    |
                    v
          Realtime notifica o Chat UI
                    |
                    v
          Mensagem aparece na tela
```

### Fluxo de Resposta (Meta)

```text
Chat UI --> meta-send-message (edge function)
                    |
                    v
          Buscar page_access_token
                    |
                    v
          Graph API (Facebook/Instagram)
                    |
                    v
          Salvar em meta_conversations (outbound)
```

### Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| Tabela `meta_conversations` | Criar via migracao |
| `supabase/functions/facebook-webhook/index.ts` | Reescrever para processar e salvar mensagens |
| `supabase/functions/meta-send-message/index.ts` | Criar nova edge function |
| `src/hooks/useMetaChat.ts` | Criar hook para conversas Meta |
| `src/pages/Chats.tsx` | Integrar fonte Meta ao lado do Evolution API |
| `supabase/config.toml` | Adicionar config da nova funcao |

### Pre-requisitos ja atendidos
- Secrets `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET` ja configurados
- Tabelas `meta_accounts` e `meta_pages` ja existem com tokens salvos
- Webhook `facebook-webhook` ja deployado e verificado com token `inboxia-verification`

