

## Diagnóstico: Chat lento para abrir

### Gargalos identificados

O fluxo atual ao abrir a tela de Chats executa **tudo em sequência e bloqueando a UI**:

1. **`listInstances()`** → chama Edge Function → Edge Function chama Evolution API para listar instâncias
2. **`getConnectionState()`** para cada instância → N chamadas à Evolution API em paralelo, mas ainda bloqueia a UI
3. **`loadChatsFromDB()`** → query de 1000 mensagens + loop O(N*M) comparando leads por telefone
4. **`fetchChats()`** para cada instância → chama Evolution API novamente
5. **Deduplicação** → loop O(chats * leads) com `find()` por cada chat
6. **Auto-criação de leads** → até 100 chamadas `createLeadSilent()` em batches de 20, com `setTimeout(1000)` entre batches
7. **Enriquecimento de perfis** → 10 chamadas `fetchProfile()` com delays de 300ms

Tudo isso acontece **antes do usuário ver qualquer conversa**. Para workspaces com milhares de leads, os loops O(N*M) sozinhos já travam.

### Plano de otimização (sem mexer no restante do sistema)

#### 1. Renderização instantânea com DB-first (prioridade máxima)

Separar o carregamento em duas fases:
- **Fase 1 (< 1s)**: Carregar chats do banco local (`whatsapp_messages`) e renderizar imediatamente
- **Fase 2 (background)**: Buscar dados da Evolution API, mesclar, e atualizar a lista sem bloquear

Mudança: O `useEffect` que carrega chats vai primeiro mostrar os dados do DB, depois atualizar com a API em background.

#### 2. Eliminar loops O(N*M) de matching de leads

Substituir `leadsRef.current.find()` (chamado para cada chat) por lookups com `Map`:
- `Map<whatsapp_jid, Lead>` — lookup O(1) por JID
- `Map<phone_last_10_digits, Lead>` — lookup O(1) por telefone

Isso já é feito parcialmente em `loadChatsFromDB` mas **não** na deduplicação (linhas 1037-1055) nem no `transformChatData` (linhas 719-723).

#### 3. Mover auto-criação de leads para background total

A auto-criação de leads (linhas 1110-1185) roda **dentro** do `loadChats` e bloqueia o `setLoadingChats(false)`. Mover para um `useEffect` separado que roda **após** os chats já estarem visíveis.

#### 4. Mover enriquecimento de perfis para não re-renderizar toda a lista

Cada `fetchProfile` chama `setChats()` que re-renderiza todos os chats. Acumular as atualizações e aplicar em batch único.

#### 5. Cache de instâncias/conexão

Guardar o resultado de `listInstances` + `getConnectionState` em `sessionStorage` para evitar chamadas repetidas ao navegar entre páginas.

### Arquivos a editar

- **`src/pages/Chats.tsx`** — refatorar o fluxo de carregamento para DB-first com API em background, otimizar loops com Maps, separar auto-criação de leads

### Resultado esperado

- Chat abre em **< 2 segundos** mostrando conversas do banco local
- Dados da Evolution API atualizam em background sem bloquear
- Auto-criação de leads e enriquecimento de perfis rodam em background sem afetar a UI

