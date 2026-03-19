

# Plano: Redesign completo do Chat — estilo Kommo/WhatsApp Web

## Problema atual

O arquivo `Chats.tsx` tem **2693 linhas** em um único componente monolítico. Cada troca de conversa dispara múltiplas queries (Evolution API + DB merge + webhook_message_log), causando delay visível. O estado anterior fica na tela por segundos antes da nova conversa carregar. Visualmente, falta polish: sem separadores de data, sem eventos inline, layout não parece um mensageiro profissional.

## O que será feito

### 1. Troca instantânea de conversa (Performance crítica)
- **Mostrar mensagens do cache imediatamente** ao clicar — sem spinner se já existem mensagens cached
- Limpar mensagens da conversa anterior **antes** de iniciar fetch da nova (elimina o "fantasma" da conversa anterior)
- Carregar DB em background sem bloquear UI
- Mover o merge API+DB para um efeito assíncrono que atualiza silenciosamente

### 2. Refatoração em componentes menores
Quebrar o monolito em:
- `ChatListSidebar.tsx` — lista de conversas, busca, filtros, seletor de instância
- `ChatConversation.tsx` — header + mensagens + input
- `ChatMessageList.tsx` — renderização das bolhas com virtualização
- `useChatMessages.ts` — hook dedicado para load/cache/realtime de mensagens
- `useChatList.ts` — hook dedicado para load/dedup/enrich de conversas

### 3. Visual estilo Kommo / WhatsApp Web
Baseado nas screenshots de referência:

- **Lista de conversas**: avatar circular com fallback de iniciais colorido, nome em bold, preview da mensagem em cinza, timestamp alinhado à direita, badge de não-lido verde
- **Bolhas de mensagem**: fundo verde claro (enviadas) e branco (recebidas) com sombra sutil, cantos arredondados assimétricos (como WhatsApp), timestamp dentro da bolha no canto inferior direito
- **Separadores de data**: linha horizontal com pill central "15/03/2026" entre grupos de mensagens de dias diferentes
- **Eventos inline**: eventos do sistema (moveu de etapa, bot executou, campo alterado) aparecem como texto cinza centralizado entre as mensagens — igual Kommo mostra "Robot Movido para: ECX USA > new leads"
- **Header da conversa**: avatar + nome + telefone + ações (agendar, ligar, favoritar)
- **Input**: barra inferior com emoji, anexo, gravação de áudio — mais compacta e limpa
- **Ações rápidas**: botões "Fechar conversa" e "Colocar em espera" na barra inferior, como no Kommo

### 4. Histórico inline com eventos do lead
- Buscar `lead_history` do lead vinculado à conversa
- Renderizar eventos entre as mensagens na timeline cronológica
- Tipos de evento: mudança de etapa, bot executou ação, campo alterado, tag adicionada
- Estilo: texto cinza pequeno centralizado com ícone, clicável para expandir detalhes

### 5. Scroll infinito melhorado
- Auto-load ao scroll para cima (já existe mas com bugs de posição)
- Corrigir preservação de scroll position usando `scrollHeightDiff`
- Mostrar skeleton placeholders durante carregamento (não spinner)
- Botão "Carregar mais" como fallback

### 6. Painel do Lead integrado (estilo Kommo)
- Já existe `LeadSidePanel` — melhorar o visual
- Mostrar funil + etapa com progresso visual (como Kommo: "ECX USA - Já é cliente (247 days)")
- Tabs: Principal, Estatísticas, Mídia, Stripe
- Campos editáveis inline (empresa, telefone, email)
- Abertura suave com animação lateral

## Detalhes técnicos

### Arquitetura de cache para troca instantânea

```text
┌─────────────┐    click     ┌──────────────────┐
│  Chat List   │───────────▶│  setSelectedChat  │
└─────────────┘             └────────┬─────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  Cache hit?          │
                          │  YES → show cached   │
                          │  NO  → show skeleton │
                          └──────────┬──────────┘
                                     │ (async)
                          ┌──────────▼──────────┐
                          │  DB query (fast)     │
                          │  → update messages   │
                          └──────────┬──────────┘
                                     │ (async)
                          ┌──────────▼──────────┐
                          │  API merge (slow)    │
                          │  → silent update     │
                          └─────────────────────┘
```

### Mudança crítica no `useEffect` de mensagens
```typescript
// ANTES: mostra loadingMessages=true por 2-5 segundos
// DEPOIS:
useEffect(() => {
  if (!selectedChat) return;
  
  // 1. Limpa conversa anterior IMEDIATAMENTE
  const cached = messageCache.get(selectedChat.id);
  if (cached) {
    setMessages(cached);        // Instantâneo
    setLoadingMessages(false);
  } else {
    setMessages([]);             // Limpa fantasma
    setLoadingMessages(true);    // Skeleton só quando não tem cache
  }
  
  // 2. Fetch DB em background
  loadFromDB(selectedChat).then(msgs => {
    setMessages(msgs);
    setLoadingMessages(false);
  });
}, [selectedChat?.id]);
```

### Separadores de data nas mensagens
```typescript
// Agrupar mensagens por dia e inserir separadores
const messagesWithDates = useMemo(() => {
  const result = [];
  let lastDate = '';
  for (const msg of messages) {
    const msgDate = formatDateLabel(msg._ts);
    if (msgDate !== lastDate) {
      result.push({ type: 'date-separator', date: msgDate });
      lastDate = msgDate;
    }
    result.push({ type: 'message', ...msg });
  }
  return result;
}, [messages]);
```

### Eventos inline do lead_history
```typescript
// Buscar eventos e mesclar na timeline
const { data: events } = await supabase
  .from('lead_history')
  .select('*')
  .eq('lead_id', leadId)
  .order('created_at', { ascending: true });

// Merge com mensagens por timestamp
const timeline = [...messages, ...events.map(e => ({
  type: 'event',
  content: formatEventLabel(e),
  _ts: new Date(e.created_at).getTime()
}))].sort((a, b) => a._ts - b._ts);
```

### Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Chats.tsx` | Refatorar — extrair componentes, corrigir troca de conversa |
| `src/components/chat/ChatListSidebar.tsx` | **Novo** — lista de conversas extraída |
| `src/components/chat/ChatConversation.tsx` | **Novo** — área de mensagens extraída |
| `src/components/chat/ChatMessageList.tsx` | **Novo** — renderização com separadores de data e eventos |
| `src/components/chat/ChatEventBubble.tsx` | **Novo** — evento inline no estilo Kommo |
| `src/hooks/useChatMessages.ts` | **Novo** — hook de mensagens com cache |
| `src/hooks/useChatList.ts` | **Novo** — hook de lista de conversas |
| `src/components/chat/MessageBubble.tsx` | Atualizar visual (cores WhatsApp, timestamp dentro da bolha) |
| `src/components/chat/ChatInput.tsx` | Ajustar layout + ações rápidas |
| `src/components/chat/LeadSidePanel.tsx` | Melhorar visual |

### Ordem de execução
1. Corrigir troca instantânea (limpar fantasma + usar cache) — impacto imediato
2. Redesign visual das bolhas e lista de conversas
3. Adicionar separadores de data
4. Extrair componentes (refatoração)
5. Eventos inline do lead_history
6. Ações rápidas (fechar conversa, espera)
7. Polish final do painel do lead

