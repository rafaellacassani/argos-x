

## Plano: Tour de Onboarding com Confirmação Prévia + Mobile Responsivo

### Problemas identificados

1. **O tour começa sozinho** — não pergunta ao usuário se ele quer iniciar, causando confusão
2. **No mobile**, o tooltip do tour tem largura fixa de 400px, fica cortado e mal posicionado (como no print)
3. O spotlight tenta apontar para elementos que podem não existir no layout mobile (sidebar colapsada, etc.)
4. O posicionamento do tooltip usa cálculos que não consideram telas pequenas — no mobile deveria ser um card fixo no bottom

### Mudanças

#### 1. Tela de boas-vindas antes do tour (Welcome Gate)
- Em `GuidedTourOverlay.tsx`, adicionar um estado `showWelcome` (true por padrão quando `isActive`)
- Antes de iniciar o tour, exibir um modal/card centralizado full-screen com:
  - Logo do Argos X
  - "Bem-vindo ao Argos X!"
  - "Preparamos um tour rápido de ~2 min para você conhecer cada recurso da plataforma."
  - Botão primário: **"Iniciar tour guiado"** → inicia o tour
  - Botão ghost: **"Pular, quero explorar sozinho"** → chama `handleSkip`
- Esse modal é simples, centralizado, e funciona perfeitamente em qualquer tela

#### 2. Tooltip 100% responsivo no mobile
- No mobile (`window.innerWidth < 768`): o tooltip vira um **card fixo no bottom** da tela (tipo bottom sheet), com `position: fixed; bottom: 0; left: 0; right: 0; width: 100%`
- Sem cálculos de posicionamento — sempre visível, sempre legível
- O spotlight ainda funciona apontando para o elemento, mas o tooltip não tenta ficar "ao lado" dele
- No desktop: mantém o comportamento atual com posicionamento inteligente

#### 3. Ajustar largura do tooltip
- Mobile: `w-full` com padding lateral, border-radius só no topo
- Desktop: manter `w-[400px] max-w-[calc(100vw-32px)]`

### Arquivos alterados
- **`src/components/tour/GuidedTourOverlay.tsx`**: welcome gate + responsive tooltip positioning
- **`src/components/layout/AppLayout.tsx`**: nenhuma mudança necessária (a lógica já passa `isActive`)

