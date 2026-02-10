

## Recuperacao de Senha - "Esqueci minha senha"

### O que sera feito

Adicionar o fluxo completo de recuperacao de senha na pagina de login, com 3 estados:

1. **Link "Esqueci minha senha"** na tela de login - envia um email com link de redefinicao
2. **Pagina de redefinicao de senha** (`/auth/reset-password`) - formulario para digitar a nova senha

### Como funciona

O sistema de autenticacao do Lovable Cloud ja possui suporte nativo para reset de senha. O fluxo sera:

1. Usuario clica em "Esqueci minha senha" na tela de login
2. Digita o email e clica em "Enviar link"
3. Recebe um email com um link de redefinicao
4. Ao clicar no link, e redirecionado para `/auth/reset-password`
5. Digita a nova senha e confirma
6. Senha atualizada com sucesso, redirecionado para o app

### Detalhes tecnicos

**Arquivo: `src/pages/Auth.tsx`**
- Adicionar um terceiro estado na pagina: `"login" | "signup" | "forgot"` (substituindo o booleano `isLogin`)
- No estado `"forgot"`: mostrar apenas o campo de email e um botao "Enviar link de recuperacao"
- Chamar `supabase.auth.resetPasswordForEmail(email, { redirectTo })` com redirect para `/auth/reset-password`
- Mostrar toast de confirmacao apos envio

**Arquivo: `src/pages/ResetPassword.tsx`** (novo)
- Pagina com dois campos: "Nova senha" e "Confirmar senha"
- Validacao com Zod (minimo 6 caracteres, senhas iguais)
- Chamar `supabase.auth.updateUser({ password })` para salvar a nova senha
- Apos sucesso, redirecionar para `/`

**Arquivo: `src/hooks/useAuth.tsx`**
- Adicionar funcao `resetPassword(email: string)` ao contexto
- Adicionar funcao `updatePassword(newPassword: string)` ao contexto

**Arquivo: `src/App.tsx`**
- Adicionar rota publica `/auth/reset-password` apontando para `ResetPassword`

