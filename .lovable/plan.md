

# Correção Urgente: Chats Vazios - Arquitetura Database-First

## Diagnóstico

O problema **não é um bug de exibição**. A tabela `whatsapp_messages` no banco local possui apenas **14 mensagens de 3 contatos** (todas a partir de 18/02 da instância `geisi-wpp`). Nenhuma mensagem da `natcrm` foi persistida.

Isso acontece porque a persistência de mensagens no banco local foi implementada recentemente, e o histórico anterior existia **somente na Evolution API**. Ao deletar as instâncias na API, esse histórico foi perdido.

## O que vamos fazer

### 1. Recuperar o histórico existente da Evolution API para o banco local
Quando as instâncias forem reconectadas (QR Code escaneado), executar uma **sincronização inicial** que busca todas as mensagens da Evolution API e as persiste no banco `whatsapp_messages`. Isso garante que, a partir de agora, todo histórico fica salvo localmente.

### 2. Garantir persistência contínua de TODAS as mensagens
O webhook (`whatsapp-webhook`) já salva mensagens recebidas. Vamos garantir que:
- Mensagens **enviadas** pelo CRM também sejam salvas
- A sincronização inicial rode automaticamente ao conectar/reconectar uma instância

### 3. Tornar o banco local a fonte PRIMÁRIA de chats (Database-First)
Inverter a lógica atual: ao invés de buscar chats da Evolution API e usar o banco como fallback, a listagem de chats e mensagens virá **sempre do banco local primeiro**, com a Evolution API usada apenas para buscar mensagens novas e sincronizar.

---

## Detalhes Técnicos

### Passo 1 - Backend: Criar Edge Function de sincronização (`sync-whatsapp-messages`)
Nova Edge Function que:
- Recebe `instanceName` e `workspaceId`
- Chama `chat/findChats/{instanceName}` na Evolution API para listar todos os contatos
- Para cada contato, chama `chat/findMessages/{instanceName}` para buscar mensagens
- Faz `upsert` no `whatsapp_messages` usando `message_id` como chave de deduplicacao
- Retorna contagem de mensagens sincronizadas

### Passo 2 - Frontend: Disparar sincronização ao reconectar instância
No `ConnectionModal.tsx`, ao detectar conexão bem-sucedida (`state === "open"`):
- Chamar `sync-whatsapp-messages` em background
- Mostrar toast: "Sincronizando historico de mensagens..."

### Passo 3 - Frontend: Arquitetura Database-First no Chats.tsx
Modificar `loadChats`:
- **Sempre** carregar lista de chats do banco local (`whatsapp_messages` agrupado por `remote_jid`)
- Em paralelo, tentar buscar chats novos da Evolution API
- Mesclar: chats do banco + chats novos da API, deduplicar por `remote_jid`
- Novas mensagens da API sao persistidas no banco automaticamente

Modificar `loadMessages`:
- **Sempre** carregar mensagens do banco local primeiro (exibicao imediata)
- Em background, buscar mensagens novas da Evolution API
- Persistir novas mensagens no banco e atualizar a UI

### Passo 4 - Garantir persistência de mensagens enviadas
Em `Chats.tsx`, nas funcoes `handleSendMessage`, `handleSendAudio`, `handleSendMedia`:
- Apos envio bem-sucedido via Evolution API, inserir a mensagem no `whatsapp_messages`

### Passo 5 - Adicionar botão manual "Sincronizar Mensagens"
Na aba WhatsApp do Settings, adicionar botao por instancia conectada: "Sincronizar Historico"
- Chama a Edge Function `sync-whatsapp-messages`
- Util para importar historico de instancias ja conectadas

---

## Resultado esperado
- Chats **nunca mais desaparecem**, independente do estado da Evolution API
- Historico de mensagens fica permanentemente no banco local
- Reconectar uma instancia automaticamente sincroniza o historico
- A interface carrega instantaneamente do banco local (sem esperar a API)

