

## Permitir ver e trocar template WABA ao editar campanha pausada

### Problema atual
O dialog de detalhes da campanha não exibe informações WABA (qual conexão Cloud e qual template está sendo usado). Quando a campanha é WABA, o `message_text` mostra apenas o nome do template (ex: "argoxscontato1") e a "Instância principal" fica vazia porque campanhas WABA não usam Evolution API.

### Correção

**Arquivo 1: `src/hooks/useCampaigns.ts`**
- Adicionar `template_id` e `template_variables` à interface `Campaign`
- Incluir esses campos no mapeamento do `fetchCampaigns` (já vêm do banco, só não estão na interface)

**Arquivo 2: `src/components/campaigns/CampaignDetailDialog.tsx`**
- Detectar se a campanha é WABA: `const isWaba = !!campaign.template_id`
- No modo **visualização**: mostrar card "Conexão WABA" e "Template" em vez de "Instância"
- No modo **edição**:
  - Carregar conexões WABA ativas do workspace (`whatsapp_cloud_connections`)
  - Carregar templates aprovados da conexão selecionada (`whatsapp_templates`)
  - Mostrar select de conexão WABA + select de template (filtrando por `status = 'APPROVED'`)
  - Ao trocar template, atualizar `editMessage` com o novo `template_name`
  - Permitir remapear variáveis do template (mesmo UI do CreateCampaignDialog)
- No `handleSaveEdits`: incluir `template_id` e `template_variables` nos updates quando alterados
- Esconder o campo "Instância principal" para campanhas WABA (não se aplica)
- Esconder o Textarea de mensagem livre para campanhas WABA (usar preview do template em vez disso)

### Detalhes técnicos

1. **Carregar dados WABA no useEffect** (quando `open`):
   - Query `whatsapp_cloud_connections` onde `workspace_id` e `is_active = true`
   - Query `whatsapp_templates` onde `workspace_id` e `status = 'APPROVED'`

2. **Estado adicional**:
   - `editTemplateId` — o template selecionado em edição
   - `editTemplateVariables` — mapeamento de variáveis
   - `cloudConnections` — lista de conexões WABA
   - `availableTemplates` — templates aprovados

3. **View mode para WABA**: Mostrar nome do template, preview dos componentes (HEADER/BODY/FOOTER/BUTTONS), e nome da conexão WABA

4. **Edit mode para WABA**: Select de template com preview, mapeamento de variáveis com shortcodes (#nome#, #empresa#, etc.)

