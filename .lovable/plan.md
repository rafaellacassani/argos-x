

## Problema atual

A aba "Cadência" em Admin Clientes tem limitações:

1. **Template WhatsApp único** -- um textarea simples que na prática nem é usado (o `process-reactivation` usa templates hardcoded por dia e só cai no template do DB como fallback).
2. **Mensagem de boas-vindas do signup** (`public-signup`) -- hardcoded no código, sem interface para editar.
3. **Sem suporte a múltiplas mensagens por dia** -- só envia uma mensagem de texto por canal por dia.
4. **Sem suporte a áudio** -- só texto.

## Plano

### 1. Nova tabela: `cadence_messages`

Substituir o campo `whatsapp_template` (texto único) por uma tabela que permite múltiplas mensagens configuráveis por dia de cadência.

```sql
CREATE TABLE public.cadence_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES reactivation_cadence_config(id) ON DELETE CASCADE,
  cadence_day integer NOT NULL,        -- -2, -1, 0, 3, 7 etc
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'email'
  message_type text NOT NULL DEFAULT 'text', -- 'text' | 'audio'
  content text,                        -- texto da mensagem (variáveis {nome}, {link}, {dias_expirado})
  audio_url text,                      -- URL do áudio no storage (quando type=audio)
  position integer NOT NULL DEFAULT 0, -- ordem de envio no mesmo dia
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cadence_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage cadence_messages"
  ON public.cadence_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
```

Adicionar também `welcome_message_template` (text, nullable) na tabela `reactivation_cadence_config` para a mensagem de boas-vindas do signup.

### 2. Atualizar UI da Cadência (`AdminClients.tsx`)

Substituir o textarea simples por uma interface por dia:

- **Accordion** por dia de cadência (ex: "Dia -2", "Dia 0", "Dia 7")
- Cada dia mostra a lista de mensagens configuradas com:
  - Tipo (texto ou áudio) via toggle
  - Textarea para texto com variáveis `{nome}`, `{link}`, `{dias_expirado}`
  - Upload de áudio (gravar ou fazer upload de arquivo .ogg/.mp3)
  - Botão "Adicionar mensagem" para múltiplas mensagens no mesmo dia
  - Drag ou setas para reordenar
  - Botão excluir mensagem
- **Seção separada** para "Mensagem de boas-vindas (signup)" com textarea editável
- Storage bucket `cadence-audio` (público) para os áudios

### 3. Atualizar `process-reactivation/index.ts`

- Remover templates hardcoded
- Buscar mensagens de `cadence_messages` filtradas por `cadence_day` e `is_active`, ordenadas por `position`
- Para cada mensagem: se `message_type = 'text'`, enviar via `sendText`; se `audio`, enviar via `sendAudio` (Evolution API endpoint `/message/sendWhatsAppAudio`)
- Manter intervalo de ~2s entre mensagens múltiplas do mesmo dia

### 4. Atualizar `public-signup/index.ts`

- Buscar `welcome_message_template` de `reactivation_cadence_config`
- Se preenchido, usar como template substituindo `{nome}`; senão, usar mensagem atual como fallback

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar `cadence_messages`, bucket, coluna `welcome_message_template` |
| `src/pages/AdminClients.tsx` | Nova UI de mensagens por dia + upload áudio + editor de boas-vindas |
| `supabase/functions/process-reactivation/index.ts` | Ler de `cadence_messages`, suportar áudio |
| `supabase/functions/public-signup/index.ts` | Ler `welcome_message_template` do DB |

