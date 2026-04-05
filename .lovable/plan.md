

## Tornar os cards do Dashboard Executivo clicáveis com drill-down

### O que muda

Adicionar modais/sheets de drill-down ao clicar nos KPIs e seções do Dashboard Executivo. O backend já retorna os dados necessarios na resposta — só precisa expandir o payload para incluir listas detalhadas onde falta, e adicionar interatividade no frontend.

### Backend (`supabase/functions/admin-clients/index.ts`)

Expandir o retorno do `executive-dashboard` para incluir listas detalhadas:

- **`active_clients_list`**: Lista de workspaces ativos pagos com `id, name, plan_name, email, phone, subscription_status, created_at`
- **`active_trials_list`**: Lista de trials ativos (todos, não só os expirando em 7 dias) com `id, name, plan_name, email, phone, trial_end, days_left`
- **`churn_list`**: Lista dos churns do mês com `id, name, plan_name, email, phone, blocked_at`
- **`past_due_list`**: Lista de inadimplentes com `id, name, plan_name, email, phone`
- **`lead_packs_list`**: Lista de pacotes ativos com `workspace_name, pack_size, price_paid`
- **`provider_clients`**: Listas por provedor (`stripe_list`, `asaas_list`, `none_list`) com `id, name, plan_name, email`

Usar dados que já estão carregados (workspaces, profileMap, leadPacks) — sem queries extras.

### Frontend (`src/components/admin/ExecutiveDashboardTab.tsx`)

1. **Adicionar estado** para controlar qual drill-down está aberto:
   ```typescript
   const [drilldown, setDrilldown] = useState<string | null>(null);
   ```

2. **Tornar clicáveis** (com `cursor-pointer` e `onClick`):
   - Card "MRR Atual" → abre lista de clientes pagos com plano e valor
   - Card "Clientes Ativos" → abre lista de clientes ativos
   - Card "Trials Ativos" → abre lista de todos os trials
   - Card "Churn do Mês" → abre lista dos churns
   - Seção "Distribuição por Plano" → badges "X pagos", "X trial", "X inadimplente" clicáveis, filtram a lista pelo plano
   - Card "Pacotes de Leads" → abre lista de pacotes ativos por workspace
   - Card "Distribuição por Provedor" → cada linha clicável mostra a lista de clientes daquele provedor

3. **Componente Sheet/Dialog** reutilizável dentro do mesmo arquivo:
   - Usa `Sheet` (lateral) com título dinâmico
   - Tabela interna com colunas: Nome, Plano, E-mail, Telefone, Status
   - Botão de WhatsApp em cada linha (já existe o helper `openChatWithPhone`)

### Detalhes técnicos

- Apenas 2 arquivos editados: `admin-clients/index.ts` e `ExecutiveDashboardTab.tsx`
- Os dados extras vêm das mesmas variáveis já computadas no backend (zero queries adicionais)
- Sheet do shadcn/ui já existe no projeto
- Tipos `DashboardData` expandidos para incluir as novas listas

