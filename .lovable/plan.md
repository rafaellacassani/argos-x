

## Plano: Permitir campanhas WABA sem exigir instância Evolution

### Problema
Na etapa 2 da criação de campanha, a validação `canProceed()` **sempre exige** uma instância Evolution selecionada (linha 277), mesmo quando o usuário escolheu enviar via Template WABA. Isso bloqueia o avanço sem necessidade, já que campanhas WABA usam a Cloud Connection (não a instância Evolution).

### Mudanças

#### `src/components/campaigns/CreateCampaignDialog.tsx`

1. **Corrigir `canProceed()`** (linha 274-282): Quando `useTemplate === true`, exigir apenas `selectedTemplateId` e uma cloud connection selecionada — **não** exigir `instanceName`.

2. **Rastrear `selectedCloudConnectionId`**: Adicionar estado para guardar qual cloud connection foi selecionada (o `Select` atual de "Conexão Cloud API" não salva o valor em estado — linha 558-559 usa `value={cloudConnections.length === 1 ? cloudConnections[0].id : undefined}` fixo).

3. **Ajustar `handleSave()`** (linha 284-325): Quando `useTemplate === true`, enviar `instance_name` como string vazia ou o nome da conexão cloud — o `process-campaigns` já resolve a conexão pelo `template_id`, então não precisa de `instance_name`.

4. **Esconder seletor de instância Evolution** quando `useTemplate` está ativo — o usuário não precisa ver/selecionar algo que não será usado. Mostrar apenas o seletor de Cloud Connection + Template.

5. **Esconder Round Robin** quando `useTemplate` está ativo (round robin é para instâncias Evolution).

### Resultado
O usuário poderá criar campanhas WABA selecionando apenas a conexão cloud e o template, sem ser bloqueado pela exigência de instância Evolution.

