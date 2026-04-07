

## Diagnóstico

O membro **Rosivaldo** (`Rosivaldo.correia@terra.com.br`) foi convidado ao workspace do Wellington, mas seu registro em `workspace_members` tem `accepted_at: NULL`. Quando ele faz login, o `ProtectedRoute` detecta que não há workspace aceito e redireciona para `/aguardando-ativacao`. Porém, essa página **nunca chama a função `accept-invite`** — ela apenas faz polling esperando que `accepted_at` seja preenchido magicamente. Resultado: loop infinito.

## Correção

**Arquivo: `src/pages/AguardandoAtivacao.tsx`**

1. Na função `check()`, **antes** de consultar `workspace_members`, chamar `supabase.functions.invoke("accept-invite")` para aceitar automaticamente qualquer convite pendente do usuário logado.
2. O `accept-invite` já existe e faz exatamente isso: busca o convite pendente por `user_id` ou `email` e define `accepted_at`.
3. A chamada é idempotente — se não houver convite pendente, retorna 404 sem efeito colateral.
4. Após a chamada, o polling existente encontrará o `accepted_at` preenchido e redirecionará para `/dashboard`.

### Correção imediata (dados)

Além da correção no código, definir `accepted_at = now()` diretamente no registro do Rosivaldo via migration para desbloquear o acesso dele imediatamente.

### Fluxo corrigido

```text
Login → ProtectedRoute (sem workspace aceito) → /aguardando-ativacao
  → chama accept-invite (aceita convite pendente)
  → polling detecta accepted_at → redireciona /dashboard
```

Nenhum outro arquivo será alterado.

