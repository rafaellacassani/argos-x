

## Problema Atual

Quando um admin adiciona um membro pela aba "Equipe", o sistema:
1. Gera um UUID aleatorio (`crypto.randomUUID()`) que nao corresponde a nenhum usuario real
2. Insere um perfil e roles com esse UUID falso
3. **Nao envia nenhum convite** -- o usuario adicionado nunca fica sabendo e nao consegue fazer login

## Solucao: Fluxo de Convite por Email

Implementar um sistema onde o admin insere o email do novo membro e o sistema envia automaticamente um convite por email com link para criar senha e acessar o workspace.

```text
Fluxo:
Admin preenche dados (nome, email, telefone, role)
  -> Chama Edge Function "invite-member"
  -> Edge Function usa admin API para criar usuario com convite
  -> Usuario recebe email com link magico
  -> Ao clicar no link, e redirecionado para pagina de definir senha
  -> Apos definir senha, o sistema detecta o workspace e redireciona ao Dashboard
```

## Etapas de Implementacao

### 1. Criar Edge Function `invite-member`

Uma nova funcao backend que:
- Recebe: `email`, `full_name`, `phone`, `role`, `workspace_id`
- Valida o JWT do admin chamador
- Usa a Admin API do sistema de autenticacao para criar o usuario e enviar convite por email
- Cria o `user_profile` com o `user_id` real retornado
- Cria o `user_roles` com o role escolhido
- Adiciona como `workspace_member` com `accepted_at = null`
- Cria `notification_settings` padrao

### 2. Atualizar o Hook `useTeam.ts`

Alterar `createTeamMember` para:
- Chamar a Edge Function `invite-member` em vez de inserir diretamente no banco
- Exigir email como campo obrigatorio (necessario para o convite)
- Tratar erros especificos (email ja existe, falha no envio, etc.)

### 3. Atualizar o Formulario `TeamManager.tsx`

- Tornar o campo **Email obrigatorio** (atualmente e opcional)
- Adicionar feedback visual: "Convite enviado para email@exemplo.com"
- Desabilitar botao Salvar se email estiver vazio

### 4. Atualizar `useWorkspace.tsx` (Auto-aceite de convite)

O fluxo existente de auto-aceite de convites por email ja esta implementado no `useWorkspace.tsx`. Quando o usuario convidado faz login pela primeira vez, o sistema:
- Detecta o convite pendente pelo email
- Aceita automaticamente (preenche `user_id` e `accepted_at`)
- Redireciona para o Dashboard

Apenas um ajuste: garantir que funciona corretamente com o novo fluxo onde o `user_id` ja vem preenchido desde a criacao.

### 5. Pagina de Aceite do Convite

Quando o usuario clica no link do email, ele e redirecionado para a pagina `/auth`. Como o usuario ja foi criado pelo convite, ele pode:
- Definir sua senha atraves do link magico recebido por email
- Fazer login normalmente apos definir a senha

## Detalhes Tecnicos

### Edge Function `invite-member`

```text
POST /invite-member
Headers: Authorization: Bearer <admin_jwt>
Body: {
  email: string (obrigatorio)
  full_name: string
  phone: string
  role: "admin" | "manager" | "seller"
  workspace_id: string
}

Resposta: {
  success: true
  user_id: string
  message: "Convite enviado"
}
```

A funcao usara `supabase.auth.admin.inviteUserByEmail()` que:
- Cria o usuario no sistema de autenticacao
- Envia automaticamente um email com link para definir senha
- Retorna o `user_id` real para associar ao perfil

### Arquivos Alterados

| Arquivo | Acao |
|---|---|
| `supabase/functions/invite-member/index.ts` | Criar (nova Edge Function) |
| `src/hooks/useTeam.ts` | Editar (`createTeamMember` chama a Edge Function) |
| `src/components/settings/TeamManager.tsx` | Editar (email obrigatorio + feedback) |

### Seguranca

- Apenas admins do workspace podem enviar convites (validado no JWT)
- O link de convite expira automaticamente apos o prazo padrao
- O usuario so acessa dados do workspace apos aceitar o convite e definir senha
