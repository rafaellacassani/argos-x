

## Corrigir filtro "respond_to: new_leads" nos Agentes de IA

### Problema

O cliente configurou o agente para responder apenas "novos leads", mas a IA responde a todos. Há dois bugs:

1. **Webhooks não filtram**: `whatsapp-webhook`, `check-missed-messages` e `facebook-webhook` só verificam `specific_stages` — nunca checam `new_leads`. Toda mensagem é encaminhada ao `ai-agent-chat`.

2. **ai-agent-chat tem lógica incorreta**: Verifica `agent_memories.length > 1`, mas como o sistema reutiliza o mesmo registro de memória (atualiza em vez de criar novo), o count quase sempre retorna 1, e a IA nunca para de responder.

### Correção

**4 arquivos**, mesma lógica adicionada em cada webhook + correção no ai-agent-chat:

#### 1. `supabase/functions/whatsapp-webhook/index.ts`
Após a busca do `existingLead` (linha ~1022), antes do bloco `specific_stages` (linha 1076), adicionar:

```
if (matchingAgent.respond_to === "new_leads" && existingLead) {
  // Lead já existia antes desta mensagem — não é novo
  shouldRespond = false;
  console.log("[whatsapp-webhook] ⏭️ Agent skipped: respond_to=new_leads but lead already exists");
}
```

Nota: se `existingLead` é null, o lead será auto-criado logo abaixo (linha 1030-1074) — nesse caso o lead É novo e `shouldRespond` permanece true. Se o lead já existia, ele não é novo e a IA não deve responder.

#### 2. `supabase/functions/check-missed-messages/index.ts`
Após linha 208, antes do bloco `specific_stages`:

```
if (matchingAgent.respond_to === "new_leads" && existingLead) {
  shouldRespond = false;
}
```

#### 3. `supabase/functions/facebook-webhook/index.ts`
Mesma lógica antes do bloco `specific_stages` existente.

#### 4. `supabase/functions/ai-agent-chat/index.ts`
Corrigir a verificação na linha 665-672. Em vez de contar memories (que são reutilizados), verificar quantas mensagens já existem no memory atual:

```typescript
if (agent.respond_to === "new_leads" && lead_id) {
  // Check if memory already has previous conversation (not new lead)
  if (memory.messages && Array.isArray(memory.messages) && memory.messages.length > 0) {
    console.log("[ai-agent-chat] ⏭️ Skipped: not_new_lead (has existing messages)");
    return response with skipped: true;
  }
}
```

### Resultado

- Leads que já existem no sistema não receberão resposta automática da IA quando `respond_to = "new_leads"`
- Apenas contatos completamente novos (sem lead cadastrado) serão respondidos
- Nenhuma outra funcionalidade é afetada

