

## Diagnóstico: Conversa incompleta no Chat

### Causa raiz

A agente IA **está respondendo corretamente** — confirmei nos logs que Wesllem recebeu "Você é estudante ou profissional formado?" e depois o link de ingresso, e Marisa também recebeu a resposta. As execuções mostram `status: success` para todas.

O problema: o `whatsapp-webhook` envia a resposta da IA via Evolution API (`sendText`), mas **nunca salva a mensagem de saída** na tabela `whatsapp_messages`. O chat UI lê dessa tabela, então só exibe as mensagens recebidas (inbound).

### Correção

Editar **`supabase/functions/whatsapp-webhook/index.ts`** — após cada envio bem-sucedido via `evolutionFetch(/message/sendText/...)` (linhas 965-1010), inserir um registro em `whatsapp_messages` com:

- `workspace_id`, `instance_name`, `remote_jid` (do lead)
- `from_me: true`, `direction: 'outbound'`
- `content`: texto do chunk/response enviado
- `message_type: 'text'`
- `push_name`: nome da agente
- `timestamp`: horário atual

Isso se aplica a dois pontos no código:
1. **Envio por chunks** (linha 963-988) — salvar cada chunk após envio
2. **Envio de resposta única** (linha 990-1010) — salvar a resposta completa após envio

Sem impacto no fluxo existente — é um `insert` adicional que não bloqueia o envio.

### Resultado esperado

Após o deploy, todas as novas respostas da IA aparecerão no chat como mensagens enviadas (bolha azul/direita), junto com as mensagens recebidas do lead.

