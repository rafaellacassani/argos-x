

## Correção: Rota /login inexistente redireciona para /cadastro

### Problema
A rota `/login` não existe no app. Quando clientes acessam `/login`:
1. Caem no wildcard `/*` protegido por `ProtectedRoute`
2. Como não estão logados, são redirecionados para `/auth?returnTo=/login`
3. Ou, se o workspace não carrega a tempo, vão direto para `/cadastro`

### Solução
Adicionar `/login` como rota pública que renderiza a mesma página `Auth`.

### Alteração
**`src/App.tsx`** -- adicionar uma linha junto às rotas públicas:
```tsx
<Route path="/login" element={<Auth />} />
```

Logo abaixo da rota existente `<Route path="/auth" element={<Auth />} />`.

### Impacto
- Correção de 1 linha
- Clientes que acessam `/login` veem a tela de login normalmente
- Sem efeito colateral

