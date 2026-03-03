

# Tour Guiado — Onboarding Interativo do Argos X

## Analise do Rascunho e Ordem Sugerida

Sua ordem esta boa mas precisa de ajustes logicos. O usuario precisa primeiro entender o "centro nervoso" (Chats + Funil) antes de funcoes avancadas. Ordem otimizada:

| # | Etapa | Rota | Por que nessa posicao |
|---|-------|------|----------------------|
| 1 | Conecte seu WhatsApp | /settings | Sem conexao, nada funciona |
| 2 | Adicione sua equipe | /configuracoes | Quem vai usar o sistema |
| 3 | Organize o Funil de Vendas | /leads | Estrutura base do negocio |
| 4 | Converse nos Chats | /chats | Funcao principal do dia-a-dia |
| 5 | Monte sua Agente de IA | /ai-agents | Automacao principal — explicacao detalhada |
| 6 | Contatos | /contacts | Lista centralizada |
| 7 | Calendario | /calendar | Agendamentos e lembretes |
| 8 | E-mail | /email | Canal complementar |
| 9 | Dashboard | /dashboard | Metricas consolidadas |
| 10 | Estatisticas | /statistics | Analise do funil |
| 11 | Alertas e Relatorios | /configuracoes | Notificacoes automaticas |
| 12 | SalesBots | /salesbots | Automacao avancada de fluxos |
| 13 | Campanhas | /campaigns | Disparos em massa |

## Abordagem Tecnica

### 1. Pagina "Tour Guiado" (`/tour-guiado`)
- Pagina standalone acessivel via sidebar (apenas Super Admin)
- Design de "linha do tempo vertical" — cada etapa e um card grande com:
  - Numero + icone da secao
  - Titulo claro em portugues
  - Descricao rica (2-4 paragrafos curtos) explicando O QUE faz, POR QUE e importante, e COMO usar
  - Para Agente de IA: sub-secoes detalhadas (Personalidade, Base de Conhecimento, FAQ, Comportamento, Qualificacao, Ferramentas, Avancado)
  - Botao "Ir para essa funcao" que navega para a rota correspondente
- Progress bar no topo mostrando quantas etapas ja foram visitadas
- Visual: cards grandes, fonte legivel, cores do sistema, sem termos em ingles

### 2. Sistema de Onboarding Obrigatorio (para novos workspaces)
- Usa os campos `onboarding_completed` e `onboarding_step` ja existentes na tabela `workspaces`
- No `AppLayout`, se `workspace.onboarding_completed !== true`, redireciona para `/tour-guiado`
- Cada etapa tem botao "Proximo" que atualiza `onboarding_step` no banco
- Botao "Ir para essa funcao" abre a pagina em nova aba ou permite voltar ao tour
- Na ultima etapa, botao "Concluir Tour" marca `onboarding_completed = true`
- Admin pode resetar o tour a qualquer momento

### 3. Descricoes Enriquecidas por Etapa

Cada etapa tera texto claro, sem jargao, exemplos praticos. Destaque especial para a etapa 5 (Agente de IA) com sub-cards explicando cada aba de configuracao:
- **Personalidade**: Nome, tom de voz, como ela se apresenta
- **Base de Conhecimento**: Textos sobre seus produtos, precos, servicos
- **FAQ**: Perguntas frequentes com respostas prontas
- **Comportamento**: Para quem responde, tempo de espera, instancia
- **Qualificacao**: Perguntas para classificar o lead automaticamente
- **Ferramentas**: Acoes automaticas (mover etapa, agendar follow-up)
- **Avancado**: Limites, horarios, configuracoes tecnicas

Para SalesBots: "Crie sequencias automaticas de mensagens. Por exemplo: quando um lead chega, o bot envia uma saudacao, espera a resposta, e encaminha para a etapa certa do funil — tudo sem precisar de um humano."

### 4. Arquivos a Criar/Editar

- **Criar**: `src/pages/TourGuiado.tsx` — pagina completa do tour
- **Editar**: `src/App.tsx` — adicionar rota `/tour-guiado`
- **Editar**: `src/components/layout/AppSidebar.tsx` — adicionar link no menu admin
- **Editar**: `src/components/layout/AppLayout.tsx` — redirect para tour se onboarding nao concluido
- **Editar**: `src/hooks/useWorkspace.tsx` — incluir `onboarding_completed` e `onboarding_step` na interface Workspace

### 5. Sem Migracao Necessaria
Os campos `onboarding_completed` e `onboarding_step` ja existem na tabela `workspaces`.

