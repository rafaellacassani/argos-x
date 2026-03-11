

## Diagnóstico: Campanhas WABA falhando 100%

### Problema identificado
**Todas as mensagens estão falhando** com erro da Meta: `"Parameter name is missing or empty"`. Ambas as campanhas têm 0 envios bem-sucedidos e ~41-42 falhas cada.

### Causa raiz
A tabela `campaign_recipients` **não tem foreign key** para `leads`. O código faz:
```
.select("*, leads(name)")
```
Sem FK, o Supabase ignora silenciosamente o join — `recipient.leads` fica `undefined` → `leadName = ""` → o parâmetro do template é enviado como string vazia → Meta rejeita.

Além disso, `template_variables` está `[]` (vazio) nas duas campanhas, então o fallback com `leadName` é a única chance, mas ele também falha pelo motivo acima.

### Correções

#### 1. Migração: Adicionar FK em `campaign_recipients.lead_id → leads.id`
Isso faz o join do Supabase funcionar corretamente.

#### 2. `process-campaigns/index.ts` — Fallback robusto
Caso o join ainda falhe por algum motivo, buscar o nome do lead separadamente:
- Após obter o recipient, se `leads?.name` estiver vazio, fazer um `SELECT name FROM leads WHERE id = recipient.lead_id`
- Garantir que o `paramValue` nunca seja string vazia — usar o telefone ou "Cliente" como último fallback

#### 3. Resetar recipients falhados para re-disparo
Após o fix, resetar os ~83 recipients com `status = 'failed'` para `pending` para que sejam reprocessados automaticamente.

### Arquivos
- **Migração SQL**: adicionar FK `campaign_recipients(lead_id) → leads(id)`
- **`supabase/functions/process-campaigns/index.ts`**: fallback para buscar nome do lead individualmente

