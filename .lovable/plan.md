

## Adicionar links de Política de Privacidade e Termos de Serviço na página Perfil & Segurança

### O que será feito
Adicionar dois links discretos no final da página `ProfileSettings.tsx`, logo após a "Zona de perigo", apontando para `/privacy-policy` e `/terms`.

### Alteração

**Arquivo:** `src/pages/ProfileSettings.tsx`

Após o `<DangerZone />` (linha 439), antes do `</div>` de fechamento (linha 440), inserir:

```tsx
{/* Links legais */}
<div className="flex items-center justify-center gap-4 pt-4 text-xs text-muted-foreground">
  <a href="/privacy-policy" target="_blank" className="hover:underline">
    Política de Privacidade
  </a>
  <span>•</span>
  <a href="/terms" target="_blank" className="hover:underline">
    Termos de Serviço
  </a>
</div>
```

### Resultado
- Links ficam visíveis para **todos os usuários** no final da página de Perfil & Segurança
- Abrem em nova aba
- Estilo discreto, sem poluir a interface

