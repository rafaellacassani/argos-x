

## Alerta de instância WhatsApp desconectada — Banner no topo do app

### O que será feito
Um banner de alerta discreto que aparece no topo do app quando alguma instância WhatsApp do workspace perde a conexão. O cliente vê qual instância caiu e tem um botão direto para ir à página de configurações e reconectar.

### Como funciona

1. **Hook `useInstanceHealth`** — novo hook que roda a cada 2 minutos (polling leve):
   - Busca as instâncias do workspace em `whatsapp_instances`
   - Para cada uma, chama `getConnectionState` via Evolution API
   - Retorna lista de instâncias desconectadas (state !== "open")
   - Só roda se o workspace tem instâncias cadastradas

2. **Componente `DisconnectedInstanceBanner`** — banner amarelo/vermelho no layout:
   - Aparece entre o `TopBar` e o conteúdo, similar ao `TrialBanner`
   - Mostra: "⚠️ WhatsApp desconectado: **Nome da instância** — Reconectar"
   - Botão "Reconectar" leva para `/settings` na aba WhatsApp
   - Se múltiplas instâncias estão off, mostra contagem
   - Pode ser dispensado temporariamente (dismiss por 30min)

3. **Integração no `AppLayout.tsx`**:
   - Adicionar o banner logo após o `TopBar`/`TrialBanner`
   - Não aparece para admin viewing

### Alterações

| Arquivo | Mudança |
|---|---|
| `src/hooks/useInstanceHealth.ts` | Novo hook — polling de status das instâncias |
| `src/components/layout/DisconnectedInstanceBanner.tsx` | Novo componente — banner de alerta |
| `src/components/layout/AppLayout.tsx` | Montar o banner no layout |

### O que NÃO será alterado
- Nenhuma edge function
- Nenhuma tabela do banco
- Nenhum outro componente

