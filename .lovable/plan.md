

## Problema identificado

O link nos e-mails e WhatsApp da régua de reativação aponta para `https://argosx.com.br/auth` (página de login). Quando o cliente clica em "Ativar antes que expire", ele vê a tela de login — não a de pagamento.

**Porém**, mesmo depois de logar, o fluxo funciona: o `AppLayout` detecta workspace bloqueado e mostra a `WorkspaceBlockedScreen` com os botões de checkout. O problema é a **experiência confusa** — o cliente espera ir direto para pagar e vê um login.

## Mapeamento de todos os pontos de ativação

| Local | Link atual | Problema |
|-------|-----------|----------|
| **E-mails da régua** (`process-reactivation`) | `https://argosx.com.br/auth` | Leva para login, não para planos |
| **WhatsApp da régua** (`process-reactivation`) | `https://argosx.com.br/auth` | Idem |
| **TrialBanner** (dentro do app) | `navigate("/planos")` | OK — já aponta para planos |
| **WorkspaceBlockedScreen** (workspace bloqueado) | `create-checkout-session` → Stripe | OK — checkout direto |
| **Página /planos** | `create-checkout-session` → Stripe | OK — checkout direto |

## Solução

### 1. Corrigir link na régua de reativação (`process-reactivation/index.ts`)

Mudar a linha 209 de:
```
const planLink = "https://argosx.com.br/auth";
```
Para:
```
const planLink = "https://argosx.com.br/planos";
```

Quando o cliente clicar:
- **Se já estiver logado**: vai direto para `/planos` com os botões de checkout do Stripe
- **Se não estiver logado**: o `ProtectedRoute` redireciona para `/auth`, e após login o React Router o leva de volta ao app — onde o `AppLayout` mostra a `WorkspaceBlockedScreen` com checkout

### 2. Melhorar redirect pós-login para workspace bloqueado (`ProtectedRoute`)

Atualmente, quando um usuário não-autenticado acessa `/planos`, é redirecionado para `/auth` mas **sem salvar a URL de retorno**. Após login, vai para `/` em vez de `/planos`.

Corrigir o `ProtectedRoute` para salvar a rota de destino e o `Auth.tsx` para redirecionar de volta após login. Isso garante que o fluxo email → login → planos funcione sem atrito.

### 3. Garantir que `/planos` funcione mesmo com workspace bloqueado (`AppLayout`)

Atualmente, se o workspace está bloqueado, o `AppLayout` intercepta **todas** as rotas e mostra `WorkspaceBlockedScreen`. Isso inclui `/planos`, que nunca renderiza.

Adicionar exceção para que `/planos` passe pelo bloqueio — já que a própria página de planos é o lugar correto para resolver o bloqueio.

### Arquivos alterados
- `supabase/functions/process-reactivation/index.ts` — link corrigido para `/planos`
- `src/components/layout/ProtectedRoute.tsx` — salvar URL de retorno ao redirecionar para login
- `src/pages/Auth.tsx` — respeitar URL de retorno após login
- `src/components/layout/AppLayout.tsx` — permitir `/planos` mesmo com workspace bloqueado

