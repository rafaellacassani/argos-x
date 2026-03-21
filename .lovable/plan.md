

## Plano: Adicionar "Painel de Dados" ao menu lateral

### O que será feito
- Adicionar o item **"Painel de Dados"** no menu lateral, posicionado logo após **"Chats"**, apontando para `/dashboard`
- Importar o ícone `LayoutDashboard` do lucide-react para o item

### Mudança técnica

**`src/components/layout/AppSidebar.tsx`**
1. Adicionar `LayoutDashboard` nos imports do lucide-react
2. Inserir na array `menuItems`, após Chats (posição 5):
   ```
   { icon: LayoutDashboard, label: "Painel de Dados", path: "/dashboard" }
   ```

Ordem final:
Início → Conexões → Agentes de IA → Chats → **Painel de Dados** → Funil de Vendas → ...

