

## Plano: Corrigir envio de templates WABA com variáveis nomeadas

### Problema
Os templates da Meta usam variáveis nomeadas (`{{customer_name}}`), mas tanto o frontend quanto o backend usam regex que só detecta variáveis numéricas (`{{1}}`, `{{2}}`). Resultado: 0 parâmetros são enviados e a Meta rejeita com erro 132000.

### Causa raiz
- Regex `/\{\{(\d+)\}\}/g` ignora `{{customer_name}}`
- `template_variables` fica vazio → API recebe 0 params

### Correções

#### 1. `src/components/campaigns/CreateCampaignDialog.tsx`
- **Linhas 604 e 632**: Expandir regex para detectar **ambos** formatos: `{{1}}` e `{{customer_name}}`
- Usar `/\{\{([^}]+)\}\}/g` que captura qualquer conteúdo entre `{{ }}`
- Isso fará o campo de mapeamento de variáveis aparecer na UI, permitindo ao usuário associar `{{customer_name}}` a `#nome#`

#### 2. `supabase/functions/process-campaigns/index.ts`
- **Linha 172**: Mesma correção de regex para detectar params nomeados
- Adicionar **fallback inteligente**: quando `template_variables` está vazio mas o template tem variáveis, usar automaticamente o nome do lead como valor padrão (já que `customer_name` é o caso mais comum)
- Buscar nome do lead via join com `campaign_recipients` → `leads`

#### 3. Correção imediata para as campanhas em andamento
- Como as campanhas já estão rodando com `template_variables: []`, o fallback no backend resolverá: se não houver mapeamento, usar o nome do lead do recipient

### Arquivos
- `src/components/campaigns/CreateCampaignDialog.tsx` — regex nas linhas 604 e 632
- `supabase/functions/process-campaigns/index.ts` — regex linha 172 + fallback com nome do lead

