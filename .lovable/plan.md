

## Problema

A página `/planos` existe no roteamento (`App.tsx`, linha 132) mas **não tem entrada no menu lateral** (`AppSidebar.tsx`). Por isso você não consegue acessá-la pela navegação — só digitando a URL.

## Solução

Adicionar um item "Planos" no menu do `AppSidebar.tsx`, usando o ícone `Crown` (ou `CreditCard`), apontando para `/planos`.

### Arquivo alterado
- `src/components/layout/AppSidebar.tsx` — adicionar entrada `{ icon: Crown, label: "Planos", path: "/planos" }` na lista `menuItems`

