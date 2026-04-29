---
name: AI Agent Calendly Sanitization Rule
description: Calendly URLs in AI responses must only be stripped when not authorized in the agent's own system_prompt/knowledge fields
type: constraint
---
**REGRA CRÍTICA:** A função `ai-agent-chat` NUNCA deve remover de forma cega TODOS os links `calendly.com` da resposta da IA.

**Motivo:** Muitos clientes (ex: Computer Doctor, agente Fredy) configuram links Calendly próprios diretamente no `system_prompt` / `knowledge_products` do agente. Strip cego deixa o cliente com mensagens tipo "Aqui está o link:  abra agora" (sem link).

**Como aplicar:** Antes de remover um link Calendly da resposta, verificar se o primeiro segmento do path do link aparece em qualquer um destes campos do agente:
- `agent.system_prompt`
- `agent.knowledge_products`
- `agent.knowledge_rules`
- `agent.knowledge_extra`
- `agent.knowledge_faq` (JSON stringificado)
- `agent.company_info` (JSON stringificado)

Se aparecer = link autorizado pelo dono do agente, MANTER. Se não aparecer = leak do histórico de outro contexto, REMOVER.

**Origem do bug:** Linha originalmente adicionada para evitar leak de Calendly de master workspaces (Aria/ECX) acabava removendo links legítimos de TODOS os agentes. Cliente comercial@computerdoctor.com.br reportou em 29/04/2026.
