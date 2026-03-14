

## Problema

O item "Suporte" (`/suporte`) não foi adicionado ao menu lateral (`AppSidebar.tsx`). A rota existe no `App.tsx` e a página `SupportAdmin.tsx` foi criada, mas falta o link no sidebar.

## Correção

Adicionar o item "Suporte" na lista de itens visíveis apenas para super admins (junto com Treinamento, Doc Agente IA e Admin Clientes), usando o ícone `Headset` do Lucide.

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/AppSidebar.tsx` | Importar `Headset`, adicionar `{ icon: Headset, label: "Suporte", path: "/suporte" }` no bloco `isSuperAdmin` |

