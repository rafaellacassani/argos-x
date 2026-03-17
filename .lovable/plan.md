

# Plano: Schema `clients` + Funil + Importação + Formulário

## Contexto

A planilha contém **~170 registros** (linhas 7-176). A maioria tem `Status do cliente = Perdido` (→ stage Cancelado), e os com `Ativo` ficam na stage Ativo. O sistema já usa `funnels` + `funnel_stages` para pipelines, então o funil "Gestão de Clientes ECX" será criado nessa estrutura existente.

Há registros duplicados na planilha (mesmo CNPJ/empresa aparece mais de uma vez). A importação fará dedup por CNPJ, mantendo o registro mais recente.

---

## Implementação

### 1. Migração: Tabela `clients`

Criar tabela `clients` com o schema solicitado, adaptando:
- `created_by` como `UUID` sem FK para `auth.users` (seguindo padrão do projeto)
- CNPJ sem constraint UNIQUE (há duplicatas na planilha; dedup será no código)
- RLS via `get_user_workspace_id(auth.uid())` (padrão existente)
- Índices em `workspace_id`, `status`, `cnpj`

### 2. Migração: Funil "Gestão de Clientes ECX"

Usar a estrutura existente (`funnels` + `funnel_stages`) para criar:
- 1 funil vinculado ao workspace master
- 4 stages: Onboarding (pos 1), Ativação (pos 2), Ativo (pos 3), Cancelado (pos 4, `is_loss_stage=true`)

Será necessário identificar o `workspace_id` do workspace master via query.

### 3. Edge Function: `import-clients`

Criar edge function que:
- Recebe o Excel como base64 ou via Storage
- Parseia com `xlsx` (importado via esm.sh)
- Mapeia colunas do Excel → campos da tabela `clients`
- Dedup por CNPJ (mais recente ganha)
- Define `stage` e `status`:
  - `Status do cliente = Perdido` → `status: 'Perdido', stage: 'Cancelado'`
  - Outros → `status: 'Ativo', stage: 'Ativo'`
- Insere em batch na tabela `clients`
- Retorna contagem de importados/ignorados

### 4. Página `ClientsPage.tsx`

Nova página `/clients` (rota protegida no AppLayout) com:

**Listagem:**
- Tabela com colunas: Nome Fantasia, Razão Social, CNPJ, Pacote, Status, Stage, Closer
- Filtros por status e stage
- Busca por nome/CNPJ
- Botão "Importar Excel" (chama edge function)

**Formulário de criação/edição (`CreateClientDialog.tsx`):**
- Campo CNPJ com botão "Buscar" que chama BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`) direto do frontend (API pública, sem CORS)
- Auto-preenche: razão social, nome fantasia, endereço, bairro, município, estado, CEP
- Checkbox "Responsável MKT e Financeiro são o mesmo sócio" → copia dados do sócio
- Dropdown Pacote: Lite / Express / Premium / Custom / Master
- Campo valor negociado com cálculo de valor por extenso (implementado no frontend com lógica simples, sem dependência externa)
- Date picker para data início pagamento

### 5. Sidebar

Adicionar link "Clientes ECX" na sidebar (visível apenas para admin do workspace ou via flag).

### 6. Importação dos dados

Após deploy da edge function, fazer upload do Excel e executar a importação para o workspace master. A edge function será chamada pela UI com um botão "Importar Excel".

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Tabela `clients` + RLS + índices |
| Migration SQL | Funil + 4 stages (workspace master) |
| `supabase/functions/import-clients/index.ts` | Edge function de importação |
| `src/pages/ClientsPage.tsx` | Página principal com listagem |
| `src/components/clients/CreateClientDialog.tsx` | Formulário de criação |
| `src/components/clients/ImportClientsDialog.tsx` | Dialog de importação Excel |
| `src/App.tsx` | Rota `/clients` |
| `src/components/layout/AppSidebar.tsx` | Link na sidebar |

---

## Notas

- Dados sensíveis (CPF, CNPJ) ficam na tabela `clients` com RLS por workspace
- Valor por extenso será gerado no frontend (evita dependência `extenso`)
- A importação será one-shot via UI, não precisa de script server-side permanente
- Funil "Gestão de Clientes ECX" é separado do funil de prospecção existente

