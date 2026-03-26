

## Bloquear contatos no Chat (Evolution API + WABA)

### O que será feito
Transformar o botão `MoreVertical` (⋮) no header do chat em um dropdown menu com a opção **"Bloquear contato"** / **"Desbloquear contato"**. Funciona tanto para instâncias Evolution API quanto WABA (Meta).

### Alterações

**1. `supabase/functions/evolution-api/index.ts`**
- Adicionar endpoint `POST /block-contact/:instanceName`
- Body: `{ number, status }` onde status = `"block"` ou `"unblock"`
- Chama Evolution API: `POST /chat/updateBlockStatus/${instanceName}` (nota: a doc oficial diz `/message/...` mas o endpoint correto é `/chat/...` conforme issue #2225)

**2. `src/hooks/useEvolutionAPI.ts`**
- Adicionar função `blockContact(instanceName: string, number: string, block: boolean): Promise<boolean>`
- Chama `supabase.functions.invoke("evolution-api", { body: { action: "block-contact", instanceName, number, status: block ? "block" : "unblock" } })`

**3. `supabase/functions/meta-send-message/index.ts`**
- Para WABA: a Meta Graph API **não suporta bloqueio de contatos** programaticamente. A opção será desabilitada para chats Meta/WABA, mostrando tooltip explicativo.

**4. `src/pages/Chats.tsx`**
- Substituir o `<Button>` com `<MoreVertical>` por um `<DropdownMenu>` contendo:
  - **Bloquear contato** (ícone `Ban`) — apenas para instâncias Evolution
  - Para instâncias Meta, o item aparece desabilitado com tooltip "Não disponível para WABA"
- Ao clicar, exibe `AlertDialog` de confirmação
- Executa `blockContact()` e mostra toast de sucesso/erro
- Também pausar a IA para esse contato (inserir na `agent_memories` com `is_paused: true`)

### Fluxo
1. Usuário clica ⋮ → "Bloquear contato"
2. Confirmação: "Tem certeza? O contato não poderá mais enviar mensagens."
3. Chama Evolution API para bloquear
4. Pausa IA para esse contato
5. Toast: "Contato bloqueado com sucesso"

### O que NÃO será alterado
- Nenhuma tabela do banco
- Nenhuma lógica de agentes, calendário, áudio, imagens
- O fluxo de mensagens existente permanece igual

