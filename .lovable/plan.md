

## Simplificar System Prompt — Visível só para super admin, auto-sync para clientes

### Problema
- Clientes editam o system prompt manualmente e ele fica desatualizado em relação às abas Personalidade/Conhecimento/FAQ
- O save atual usa `formData.system_prompt || autoPrompt` — ou seja, se o campo tiver qualquer texto, o auto-gerado é ignorado
- Clientes não-técnicos não devem ver este campo

### Solução

**1. Esconder o System Prompt para clientes** (`AdvancedTab.tsx`)
- Usar `isAdminViewing` do `useWorkspace()` para mostrar o campo apenas quando o super admin estiver visualizando o workspace
- Clientes normais verão a aba Avançado sem o campo System Prompt

**2. Forçar auto-geração no save** (`AgentDetailDialog.tsx`)
- Mudar a lógica de save: quando o usuário **não** é super admin, sempre usar `autoPrompt` (ignorar `formData.system_prompt`)
- Quando **é** super admin e preencheu o campo manualmente, respeitar o valor manual
- Isso garante que o prompt esteja sempre sincronizado com as abas de configuração

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/tabs/AdvancedTab.tsx` | Importar `useWorkspace`, mostrar seção System Prompt apenas se `isAdminViewing === true` |
| `src/components/agents/AgentDetailDialog.tsx` | Importar `useWorkspace`, na lógica de save: se `!isAdminViewing`, sempre usar `autoPrompt` em vez de `formData.system_prompt` |

### Resultado
- **Clientes**: nunca veem o System Prompt, prompt sempre auto-gerado e sincronizado
- **Super Admin (vocês)**: campo visível, editável, respeitado no save

