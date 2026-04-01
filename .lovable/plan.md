

## Corrigir nome do emissor (issuer) no 2FA/TOTP

### Problema
O `supabase.auth.mfa.enroll()` na linha 175 não passa o parâmetro `issuer`, então o Supabase usa o domínio do projeto como padrão, resultando em "argosx-.Lovable.app" no app autenticador.

### Solução
Adicionar o parâmetro `issuer: "Argos X"` na chamada de enroll.

### Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/pages/ProfileSettings.tsx` | Linha 175: adicionar `issuer: "Argos X"` ao objeto passado para `mfa.enroll()` |

### Código

```typescript
// De:
const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });

// Para:
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: "totp",
  issuer: "Argos X",
});
```

### Observação
Usuários que **já ativaram** o 2FA não serão afetados (o nome no autenticador já foi gravado). A mudança vale apenas para novos enrollments. Se você quiser corrigir o seu, basta desativar o 2FA e ativar novamente.

