
Objetivo: corrigir o disparo do SalesBot para que o botão “Executar agora para todos na etapa” não fique preso em execução, reflita sucesso/erro real e envie para todos os leads elegíveis.

O que verifiquei
- Não há diferença relevante por ter executado pelo preview: o fluxo chama o mesmo backend.
- O problema principal não é o botão em si; o envio está falhando no backend para muitos leads.
- Os logs mostram erro real da integração WhatsApp:
  - `exists:false`
  - exemplos: `27349857589`, `97984151735`, `11119624811`, `31999867827`
- Na etapa `fc4b4ff8-fbb8-40f3-ad51-9f6564b6ae3b`, a maioria dos leads está com:
  - `whatsapp_jid = null`
  - `instance_name = null`
  - telefone sem padronização consistente
- O bot `2cbc4f4d-a2bb-4aaa-86af-345f141f4247` usa a instância `iara-mkt-boost` no nó.
- Há outro problema de lógica: o bulk marca sucesso mesmo quando o envio falha, porque:
  - `executeFlow()` retorna `success: false`, mas não lança erro
  - `executeStageAutomations()` engole esse resultado
  - o loop do “Executar agora” incrementa `successCount` só porque a função terminou sem exception
- Também há disparo duplo:
  - a automação da etapa faz `run_bot`
  - depois o mesmo `on_enter` ainda aciona bots `stage_change`
  - isso explica pares de tentativas/erros para o mesmo lead

Plano de correção
1. Corrigir a contabilização do bulk
- Fazer `executeStageAutomations()` retornar um resultado estruturado por lead/automação.
- Quando o `run_bot` falhar, propagar isso como falha real.
- No botão “Executar agora para todos”, contar:
  - enviados com sucesso
  - falhas
  - ignorados
- Mostrar progresso/finalização real, em vez de aparentar sucesso.

2. Parar o disparo duplicado
- Evitar que o mesmo lead execute duas vezes no mesmo clique:
  - ou a automação `run_bot`
  - ou o gatilho `stage_change`
- Aplicar uma regra única para o bulk manual, para não duplicar mensagens e não dobrar erros.

3. Padronizar/validar telefone antes de enviar
- Reusar a lógica de validação já existente no projeto para número WhatsApp.
- Normalizar telefone antes de chamar a integração:
  - remover caracteres não numéricos
  - completar DDI/DDD quando possível
  - preferir `whatsapp_jid` quando existir
- Se o lead não tiver número válido, marcar como “inválido/pulado” em vez de travar ou contar como sucesso.

4. Melhorar diagnóstico por lead
- Registrar no resultado do bulk o motivo da falha:
  - número inválido
  - contato não existe no WhatsApp
  - instância ausente
  - erro da integração
- Exibir um resumo útil no final e deixar os detalhes rastreáveis nos logs.

5. Endurecer a execução do SalesBot
- Ajustar `useBotFlowExecution` para devolver erro claro quando o envio falhar.
- Garantir fallback de instância sem depender do lead ter `instance_name`.
- Revisar o tratamento de múltiplos nós de mensagem para que o fluxo termine corretamente mesmo com falhas parciais.

Arquivos que eu alteraria
- `src/hooks/useStageAutomations.ts`
  - retornar resultado estruturado e parar de esconder falhas
  - evitar dupla execução `run_bot` + `stage_change`
- `src/components/leads/FunnelAutomationsPage.tsx`
  - usar o resultado real por lead no bulk
  - ajustar progresso/contagem final
- `src/hooks/useBotFlowExecution.ts`
  - validar/normalizar destino
  - propagar erro de envio corretamente
- Possivelmente `src/hooks/useEvolutionAPI.ts`
  - centralizar melhor a resposta de erro da integração, se necessário

Resultado esperado após a implementação
- Executar pelo preview ou pela interface normal terá o mesmo comportamento correto.
- O botão não ficará “em execução” sem feedback útil.
- O sistema não dirá que enviou quando na verdade falhou.
- Leads com número ruim serão identificados claramente.
- Leads válidos serão processados uma vez só, sem duplicidade.

Detalhe técnico importante
- Hoje o gargalo real não é “celular aberto” nem a tela do preview.
- O backend está recusando vários destinos porque muitos contatos dessa etapa não são reconhecidos como WhatsApp válido pela integração.
- Então a correção precisa atacar duas frentes:
  1. lógica de execução/contagem
  2. higiene/validação dos números antes do envio
