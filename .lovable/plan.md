

## Plano: Criar aba "Conexão" no painel do Agente de IA

### O que será feito
- Criar uma nova aba **"Conexão"** como **primeira opção** no menu lateral do painel de edição do agente
- Mover para essa aba: seleção de **Instância WhatsApp** e toggle **"Respeitar janela de 24h (Cloud API)"**
- Remover esses dois blocos da aba "Comportamento"

### Mudanças técnicas

**1. Novo arquivo: `src/components/agents/tabs/ConnectionTab.tsx`**
- Componente com a mesma lógica que existe hoje no BehaviorTab (linhas 122-174): busca instâncias Evolution + Cloud connections do workspace, renderiza o `<Select>` de instância e o toggle de 24h
- Props: `formData` + `updateField` (mesmo padrão das outras abas)

**2. `src/components/agents/AgentDetailDialog.tsx`**
- Importar `ConnectionTab` e ícone `Plug` do lucide-react
- Adicionar `{ id: "connection", label: "Conexão", icon: Plug }` como **primeiro item** do array `tabs`
- Renderizar `<ConnectionTab>` quando `activeTab === "connection"`

**3. `src/components/agents/tabs/BehaviorTab.tsx`**
- Remover: estados `instances` e `cloudConnections`, queries de WhatsApp (linhas 22-23, 30-35)
- Remover: bloco "Instância WhatsApp" (linhas 122-151) e bloco "Cloud API 24h" (linhas 153-174)
- Manter: "Quem ela responde", "Tempo de resposta", "Tamanho das respostas", "Controle de Pausa"

