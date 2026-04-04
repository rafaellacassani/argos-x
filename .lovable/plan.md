

## Atualizar preços e features dos planos na Landing Page

### O que mudar

Arquivo: `src/pages/LandingPage.tsx` (linhas 75-122)

Atualizar o array `plans` para corresponder aos valores corretos:

**Essencial** (R$ 47/mês):
- 1 WhatsApp conectado
- Até 300 clientes
- Agente de IA incluído
- 1 usuário
- Funil de vendas visual
- CTA: "Começar por R$ 47"
- Frase extra: "Menos que uma pizza pra nunca mais perder cliente"

**Negócio** (R$ 97/mês) — Mais popular:
- 3 WhatsApps conectados
- Até 2.000 clientes
- 3 Agentes de IA
- 1 usuário (+ R$ 37 por adicional)
- Campanhas em massa
- Relatórios completos
- CTA: "Começar por R$ 97"
- highlight: true

**Escala** (R$ 197/mês):
- WhatsApps ilimitados
- Clientes ilimitados
- Agentes de IA ilimitados
- 3 usuários (+ R$ 57 por adicional)
- Tudo do Negócio + Suporte prioritário
- **SEM** White-label
- CTA: "Começar por R$ 197"

### Detalhes técnicos
- Editar apenas o array `plans` no `LandingPage.tsx`
- Valores alinhados com `PLAN_DEFINITIONS` em `usePlanLimits.ts`
- Todos os CTAs linkam para `/cadastro` (já funciona assim)

