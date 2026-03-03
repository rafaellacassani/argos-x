

## Entendi o que você quer

Não, o que eu fiz foi uma **página separada** com uma lista de passos. O que você quer é um **tour interativo por cima da interface real** — tipo aquelas janelinhas que aparecem destacando um botão ou área da tela, com uma seta apontando e um texto explicando "clique aqui para fazer X", e aí o usuário clica em "Próximo" e a janelinha pula para o próximo elemento.

Pense no estilo do **Google quando você abre o Gmail pela primeira vez**, ou apps como Notion/Trello que mostram tooltips guiados.

## Como vou implementar

### Componente de Tour Overlay
- Um componente `<GuidedTourOverlay />` que fica renderizado no `AppLayout`
- Ele cria um **overlay escuro** sobre toda a tela, com um **recorte (spotlight)** exatamente no elemento que está sendo explicado
- Uma **caixa de diálogo flutuante** (tooltip) posicionada ao lado do elemento destacado, com:
  - Título do passo
  - Descrição curta e clara
  - Botões "Anterior" / "Próximo" / "Pular tour"
  - Indicador de progresso (ex: "3 de 13")

### Navegação automática entre páginas
- Cada passo define: a **rota** da página e o **seletor CSS** do elemento a destacar
- Quando o usuário clica "Próximo" e o próximo passo está em outra página, o sistema **navega automaticamente** para aquela rota e depois destaca o elemento
- Exemplo: Passo 1 vai para `/settings` e destaca o botão de conectar WhatsApp. Passo 2 vai para `/configuracoes` e destaca a área de equipe.

### Os 13 passos com elementos reais
Cada passo terá um `targetSelector` (elemento da UI real a destacar) e `route` (para onde navegar):

| # | Rota | Elemento destacado | Texto |
|---|------|--------------------|-------|
| 1 | /settings | Área de conexão WhatsApp | "Conecte o WhatsApp da sua empresa aqui" |
| 2 | /configuracoes | Seção de equipe | "Adicione vendedores e gestores" |
| 3 | /leads | Kanban do funil | "Organize as fases do seu funil" |
| 4 | /chats | Painel de conversas | "Converse com seus leads aqui" |
| 5 | /ai-agents | Card de agente | "Monte sua agente de IA" |
| 6 | /contacts | Lista de contatos | "Todos os seus leads organizados" |
| 7 | /calendar | Calendário | "Agende compromissos" |
| 8 | /email | Caixa de e-mail | "Sincronize seu e-mail" |
| 9 | /dashboard | Cards de métricas | "Acompanhe suas métricas" |
| 10 | /statistics | Gráficos do funil | "Analise o progresso dos leads" |
| 11 | /configuracoes | Seção de alertas | "Configure alertas e relatórios" |
| 12 | /salesbots | Lista de bots | "Crie sequências automáticas" |
| 13 | /campaigns | Área de campanhas | "Dispare campanhas em massa" |

### Implementação técnica

**Arquivos a criar:**
- `src/components/tour/GuidedTourOverlay.tsx` — Overlay com spotlight, tooltip flutuante, navegação entre passos
- `src/components/tour/tourSteps.ts` — Definição dos 13 passos (rota, seletor, título, descrição)
- `src/components/tour/SpotlightMask.tsx` — SVG/CSS que escurece a tela exceto o elemento alvo

**Arquivos a editar:**
- `src/components/layout/AppLayout.tsx` — Renderizar `<GuidedTourOverlay />` e ativar automaticamente se `onboarding_completed === false`
- Manter a página `TourGuiado.tsx` existente como referência para admin resetar/ver o tour

### Mecânica do spotlight
- Usa `element.getBoundingClientRect()` para pegar a posição do elemento alvo
- Overlay com `position: fixed; inset: 0` e `pointer-events: none` no elemento destacado
- Recorte via `clip-path` ou SVG mask com um "buraco" no elemento
- Tooltip posicionado com lógica de auto-placement (acima, abaixo, lado — conforme espaço disponível)
- Animação suave (framer-motion) entre passos

### Fallback
Se o seletor CSS do elemento não for encontrado na página (por exemplo, a página ainda está carregando), o tooltip aparece centralizado com a descrição do passo e um botão para pular.

