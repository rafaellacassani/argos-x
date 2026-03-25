

## Plano: Scroll automático para última mensagem ao abrir chat

### Problema
Ao abrir um chat, as mensagens aparecem no topo (mensagens mais antigas), forçando o usuário a rolar manualmente até o final para ver as mensagens recentes.

### Solução

**Arquivo: `src/pages/Chats.tsx`**

1. **Adicionar função `scrollToBottom`** que rola o container de mensagens até o final:
   ```ts
   const scrollToBottom = useCallback(() => {
     const el = messagesContainerRef.current;
     if (el) el.scrollTop = el.scrollHeight;
   }, []);
   ```

2. **Adicionar `useEffect` para scroll automático** após mensagens carregarem (quando `loadingMessages` muda de `true` para `false`, ou quando mensagens são definidas pela primeira vez para um chat):
   ```ts
   useEffect(() => {
     if (!loadingMessages && messages.length > 0) {
       requestAnimationFrame(() => scrollToBottom());
     }
   }, [loadingMessages, selectedChat?.id]);
   ```

3. **Scroll ao enviar mensagem** — adicionar `scrollToBottom()` após cada `setMessages` que adiciona mensagens novas (envio de texto, áudio, arquivo), e também no handler de realtime quando chega mensagem nova no chat aberto.

4. **Limitar carga inicial a ~30 mensagens mais recentes** (já é o padrão atual com `limit(30)`) — manter o carregamento sob demanda de mensagens antigas via scroll-to-top, que já funciona.

### O que NÃO será alterado
- Nenhuma edge function
- Nenhuma lógica de agentes de IA
- Nenhum outro componente ou página
- A lógica de infinite scroll para mensagens antigas (scroll-to-top) permanece intacta

