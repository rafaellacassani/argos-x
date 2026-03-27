

## Criar lead automaticamente quando a IA atende (sem depender de SalesBot)

### Problema identificado
No `whatsapp-webhook/index.ts`, a criação automática de leads acontece **somente** dentro do fluxo de SalesBots (linha 1334). Quando um **Agente de IA** atende a conversa, o webhook retorna na linha 1243 (`handler: "ai_agent"`) **antes** de chegar ao código que cria o lead. Resultado: contatos atendidos pela IA ficam sem card no funil.

### Causa raiz
O fluxo é sequencial:
1. Verifica AI Agents → se encontra, responde e **retorna** (sem criar lead)
2. Verifica SalesBots → se encontra, **cria lead** se não existe e executa o bot

Workspaces que usam apenas IA (sem SalesBot ativo) nunca criam leads automaticamente.

### Correção

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Adicionar criação automática de lead **dentro do bloco do AI Agent** (antes de chamar `ai-agent-chat`), quando `leadId` for null:

```
// Após linha ~1018 (leadId = existingLead?.id || null)
// Se não existe lead, criar automaticamente
if (!leadId && phoneNumber.length >= 10 && phoneNumber.length <= 15) {
  // Buscar primeira etapa do funil padrão
  const { data: defaultFunnel } = await supabase
    .from("funnels").select("id")
    .eq("workspace_id", workspaceId).eq("is_default", true)
    .limit(1).single();
  
  let stageId = null;
  if (defaultFunnel) {
    const { data: firstStage } = await supabase
      .from("funnel_stages").select("id")
      .eq("funnel_id", defaultFunnel.id)
      .order("position", { ascending: true }).limit(1).single();
    stageId = firstStage?.id;
  }
  if (!stageId) {
    const { data: anyStage } = await supabase
      .from("funnel_stages").select("id")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true }).limit(1).single();
    stageId = anyStage?.id;
  }
  
  if (stageId) {
    const preferredJid = (!resolvedRemoteJid.endsWith("@lid") ? resolvedRemoteJid : remoteJid) || remoteJid;
    const { data: newLead } = await supabase
      .from("leads").insert({
        name: pushName || `+${phoneNumber}`,
        phone: phoneNumber,
        whatsapp_jid: preferredJid,
        instance_name: instanceName,
        source: "whatsapp",
        stage_id: stageId,
        workspace_id: workspaceId,
      }).select("id").single();
    
    if (newLead) {
      leadId = newLead.id;
      console.log(`[whatsapp-webhook] ✅ Auto-created lead for AI agent: ${leadId}`);
    }
  }
}
```

### Resultado
- **Antes**: Contatos atendidos pela IA ficavam sem lead no funil
- **Depois**: Todo contato novo que a IA atende ganha um card automaticamente na primeira etapa do funil padrão
- A lógica de SalesBots permanece inalterada
- Nenhuma outra alteração necessária

