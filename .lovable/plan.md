

## Plano: Melhorias nas Automações de Funil

### Problemas identificados

1. **Delay em dias**: O gatilho "Após tempo" só mostra horas. O usuário quer poder escolher "1 dia após entrar na etapa" de forma amigável.

2. **Bots não aparecem**: O select de bots filtra `bots.filter(b => b.is_active)`, excluindo bots inativos. Mas o fetch em si funciona (RLS filtra por workspace). Solução: mostrar todos os bots (ativos e inativos), com indicador visual de status.

3. **"Enviar agora para todos na etapa"**: Botão para executar a ação da automação imediatamente em todos os leads da etapa atual.

---

### Correções

**Arquivos alterados**: `FunnelAutomationsPage.tsx` e `StageAutomationsDialog.tsx` (ambos têm código duplicado de ActionConfigForm e trigger delay)

#### 1. Delay com unidade amigável (horas / dias)
- Adicionar um select de unidade (horas / dias) ao lado do input numérico
- Quando o gatilho for `on_enter` ou `on_exit`, também permitir "X tempo após" (campo `trigger_delay_hours` convertido: se dias, multiplica por 24)
- UI: `[Input: 1] [Select: dias/horas]` ao invés de apenas `[Input] horas`
- Aplicar em AMBOS os dialogs (FunnelAutomationsPage + StageAutomationsDialog)

#### 2. Mostrar todos os bots no select
- Remover filtro `.filter(b => b.is_active)` do select de bots
- Mostrar badge "(inativo)" ao lado do nome de bots desativados para diferenciar
- Aplicar em AMBAS as `ActionConfigForm`

#### 3. Botão "Executar para todos na etapa"
- Adicionar botão no formulário de automação: "Executar agora para todos na etapa"
- Ao clicar: busca todos os leads da etapa (`leads` where `stage_id = editingStageId`), e chama `executeStageAutomations` para cada lead
- Mostrar loading/progress e toast de conclusão
- Disponível somente no `FunnelAutomationsPage` (onde temos contexto de todas as etapas)

---

### Detalhes técnicos

| Local | Mudança |
|-------|---------|
| `FunnelAutomationsPage.tsx` linhas 365-375 | Substituir input de horas por input + select (horas/dias). Converter para hours no save |
| `FunnelAutomationsPage.tsx` linhas 508-523 | Remover `.filter(b => b.is_active)` do bot select, adicionar indicador |
| `FunnelAutomationsPage.tsx` form dialog | Adicionar botão "Executar para todos" que busca leads e executa a ação |
| `StageAutomationsDialog.tsx` linhas 284-296 | Mesmo fix de delay com unidade |
| `StageAutomationsDialog.tsx` linhas 438-456 | Mesmo fix de bot select |
| `useStageAutomations.ts` | Adicionar função `executeForAllInStage(stageId, automation)` que busca leads e executa a ação para cada um |

