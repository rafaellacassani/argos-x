
# Reestruturação do Admin Clientes (Argos X)

## Diagnóstico do que existe hoje

A página `/admin/clients` tem **7 abas** com bastante sobreposição:

1. **Novo Cliente** — 2 formulários (link Stripe + workspace gratuito)
2. **Clientes** — tabela principal com filtros, ações em massa, edição, limites, plano, exclusão
3. **Convites Pendentes** — lista de invites Stripe não concluídos
4. **Cadência** — config de reativação + mensagens por dia + log
5. **Pré-Cobrança** — config de e-mails D-3, D-1, dia da cobrança + log
6. **Saúde & Monitoramento** — tabela de saúde por workspace (agentes, tokens, instâncias, alertas) — **NÃO ABRE (timeout)**
7. **Dashboard Executivo** — MRR, churn, gráficos

Além disso existe `/admin/panel` (rota separada, antiga) com uma tabela duplicada de workspaces + ativar trial/bloquear/desbloquear — **não está nem no menu**, mas continua acessível e duplica funções já presentes em "Clientes".

### Por que "Saúde & Monitoramento" não abre

Na edge function `admin-clients` (action `health-monitoring`), depois de já carregar dados em paralelo, há um loop **sequencial** que faz uma query `count` por workspace:

```
for (const wsId of wsIds) {
  const { count } = await supabaseAdmin.from("leads").select(... count: "exact", head: true).eq("workspace_id", wsId);
}
```

Com ~50–150 workspaces, isso vira 50–150 round-trips serializados → estoura o timeout. Além disso, carrega `user_profiles` inteiro sem filtrar pelos `wsIds`.

---

## Nova estrutura proposta (de 7 abas → 4)

```text
Admin Clientes
├── 1. Visão Geral        (antes: Dashboard Executivo + cards de saúde no topo)
├── 2. Clientes           (antes: Clientes + Convites + Saúde + AdminPanel + Novo Cliente)
├── 3. Comunicação        (antes: Cadência + Pré-Cobrança)
└── 4. Configurações      (limites padrão por plano + acessos rápidos)
```

### 1. Visão Geral
- KPIs em cards no topo: MRR, Clientes ativos, Trials ativos, Churn 30d, Workspaces com alertas, Tokens 30d.
- 2 gráficos compactos: receita por mês e novos clientes por mês.
- Lista "Precisam de atenção" (top 10): trials expirando ≤3d, pagamento pendente, instância desconectada, consumo >90%.
- Botão "Ver tudo" leva à aba **Clientes** com filtro pré-aplicado.
- Substitui a aba "Dashboard Executivo" atual e o topo poluído da tabela.

### 2. Clientes (aba unificada — o coração)
Uma única tabela poderosa que funde **Clientes + Convites + Saúde + AdminPanel**.

Colunas:
- Workspace + dono (nome/email/whatsapp)
- Plano (badge) + status (ativo/trial/expirado/bloqueado/convite pendente)
- Uso (Leads X/Y, IA X/Y) — barra mini
- Instâncias conectadas (✓/total) com cor
- Atividade 24h (✓ se houve execução)
- Última ação
- Menu de ações (⋯)

Filtros no topo (chips):
- Status (todos / ativos / trial / trial expirando ≤3d / bloqueados / convite pendente / cancelados)
- Plano
- Saúde (todos / com alertas / sem agente / instância off / consumo crítico / inativos)
- Busca (nome/email/whatsapp)
- Data de criação

Ações no menu de cada linha (consolidam tudo que hoje está espalhado):
- Ver detalhes (drawer com saúde completa: agentes, instâncias, tokens 30d, custo estimado, alertas) — **substitui o Sheet de "Saúde"**
- Abrir conversa (já existe)
- Editar dados
- Mudar plano
- Editar limites
- Ativar trial manual / Bloquear / Desbloquear (vindos do AdminPanel)
- Reenviar convite (para invites pendentes)
- Copiar link de checkout
- Excluir workspace

Ações em massa (já existentes): WhatsApp em massa + seleção.

Botões no header da aba:
- "+ Novo Cliente" → abre modal com 2 tabs internas (Link Stripe / Workspace Gratuito) — tira o formulário sempre visível
- "Atualizar"

### 3. Comunicação (aba unificada)
Sub-abas internas leves:
- **Cadência de Reativação** (atual aba Cadência)
- **Pré-Cobrança** (atual aba Pré-Cobrança)
- **Métricas de Cadência** (mini painel `CadenceMetricsPanel` que hoje fica perdido)

Mesma lógica e dados, só agrupados — nada de migração de dados.

### 4. Configurações
- Limites padrão por plano (referência rápida — read-only puxando de `PLAN_DEFINITIONS`)
- Atalhos: Suporte (`/suporte`), Mapa Operacional (`/admin/mindmap`), Documentação

### Remoções / depreciação
- **Rota `/admin/panel`**: redirecionar para `/admin/clients` (funções já estão dentro do menu de cada linha). Sem perda de funcionalidade.
- Aba "Dashboard Executivo" separada: vira "Visão Geral".
- Aba "Saúde & Monitoramento" separada: vira filtros + drawer de detalhe na aba "Clientes".
- Aba "Convites Pendentes" separada: vira filtro de status na aba "Clientes" + linha com badge "Convite pendente".

---

## Correção do bug "Saúde não abre" (crítico)

Na edge function `supabase/functions/admin-clients/index.ts`, action `health-monitoring`:

1. Substituir o loop `for (const wsId of wsIds)` por **um único `select` com group by** ou contar em memória a partir de um `select workspace_id from leads where workspace_id in (...)`.
2. Filtrar `user_profiles` por `in('user_id', creatorIds)` em vez de carregar tudo.
3. Adicionar `console.time` para futuras medições.
4. Garantir que retorna mesmo se um sub-select falhar (não derrubar tudo).

Isso sozinho destrava a aba antes mesmo da reestruturação visual.

---

## Detalhes técnicos

**Arquivos a editar:**
- `src/pages/AdminClients.tsx` — refatorar para 4 abas, mover modais do "Novo Cliente" para Dialog, integrar filtros de saúde, adicionar drawer "Ver detalhes" reutilizando o conteúdo já presente em `WorkspaceHealthTab`.
- `src/components/admin/WorkspaceHealthTab.tsx` — quebrar em 2 partes: `WorkspaceHealthDrawer` (reutilizado pela tabela unificada) e remover a tabela duplicada.
- `src/components/admin/ExecutiveDashboardTab.tsx` — virar `OverviewTab` com layout mais enxuto + lista "Precisam de atenção".
- `src/components/admin/CommunicationTab.tsx` — **novo**, agrupa Cadência + Pré-Cobrança + Métricas de cadência via sub-tabs.
- `src/App.tsx` — redirecionar `/admin/panel` → `/admin/clients`.
- `supabase/functions/admin-clients/index.ts` — corrigir handler `health-monitoring` (perf).

**Sem mudança de schema do banco.** Tudo é reorganização de UI + um patch de performance na edge function.

**Sem perda de funcionalidade.** Toda ação hoje disponível continua existindo, só fica em local mais óbvio.

---

## Resultado esperado

- De **7 abas → 4 abas**.
- De **2 telas admin (`/admin/panel` + `/admin/clients`) → 1 só**.
- "Saúde & Monitoramento" passa a abrir em <2s e vira parte natural da tabela de Clientes (filtro + drawer de detalhe).
- "Novo Cliente" sai do caminho principal (vira botão + modal) — você não precisa ver dois formulários toda vez que entra na tela.
- Comunicação (cadência + pré-cobrança + métricas) vira um lugar só.
