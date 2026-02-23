
# Criar Workspace Gratuito pelo Painel Admin

## O que será feito

Adicionar um novo fluxo no painel de Gestão de Clientes (`/admin/clients`) que permite criar um workspace gratuito diretamente, sem passar pelo Stripe. O admin preenche os dados do cliente (e-mail, nome, telefone), e o sistema:

1. Cria a conta do usuário (ou localiza se já existir)
2. Cria o workspace com `plan_type = 'active'` e `plan_name = 'gratuito'`
3. Cria o perfil do usuário
4. Adiciona o usuário como admin do workspace
5. Cria o funil padrão com os 6 estágios
6. O cliente aparece na lista de clientes com o badge "Gratuito"

---

## Mudancas

### 1. Edge Function `admin-clients` — nova action `create-free-workspace`

Adicionar uma nova action que:
- Recebe `email`, `fullName`, `phone` (opcional)
- Cria o usuario via `supabaseAdmin.auth.admin.createUser()` (com `email_confirm: true` para já confirmar). Se o usuário já existir, busca o ID existente.
- Cria o `user_profiles` com nome, email e telefone
- Cria o workspace com limites generosos (ou iguais ao plano Semente) e `plan_name = 'gratuito'`, `plan_type = 'active'`, `subscription_status = 'active'`
- Adiciona o membro como admin com `accepted_at` preenchido
- Cria funil padrão + 6 estágios (mesma lógica do `create-workspace`)
- Retorna o workspace criado

### 2. Frontend `AdminClients.tsx` — novo formulário

Adicionar na aba "Novo Cliente" um segundo card/botao "Criar Workspace Gratuito" com campos:
- Nome completo (obrigatório)
- E-mail (obrigatório)
- Telefone (opcional)

Ao clicar, chama a edge function com `action: "create-free-workspace"`. Exibe toast de sucesso e atualiza a lista.

### 3. Constante `PLAN_DEFINITIONS` — adicionar plano gratuito

Adicionar entrada `gratuito` no `PLAN_DEFINITIONS` para que o badge e labels funcionem corretamente na lista de clientes.

### 4. Lista de Clientes — badge "Gratuito"

O `plan_name` será `'gratuito'`, então o badge ja aparecera automaticamente na tabela. Basta garantir que o `getPlanBadge` trate o status `active` corretamente (ja trata).

---

## Detalhes Tecnicos

**Edge Function (`supabase/functions/admin-clients/index.ts`)**:
- Nova action `create-free-workspace`
- Usa `supabaseAdmin.auth.admin.createUser({ email, password: randomPassword, email_confirm: true })` para criar conta com email ja confirmado
- Se receber erro de "user already exists", busca o user por email via `supabaseAdmin.auth.admin.listUsers()`
- Insere em `user_profiles`, `workspaces`, `workspace_members`, `funnels`, `funnel_stages`
- Limites do workspace gratuito: `lead_limit: 300, whatsapp_limit: 1, user_limit: 1, ai_interactions_limit: 100`

**Frontend (`src/pages/AdminClients.tsx`)**:
- Novo estado para alternar entre "Link Stripe" e "Workspace Gratuito"
- Formulario simplificado (sem selecao de plano)
- Feedback visual com toast de sucesso

**Constantes (`src/hooks/usePlanLimits.ts`)**:
- Adicionar `gratuito: { name: 'Gratuito', price: 0, leadLimit: 300, whatsappLimit: 1, userLimit: 1, aiLimit: 100, color: 'gray', description: 'Plano gratuito' }`
