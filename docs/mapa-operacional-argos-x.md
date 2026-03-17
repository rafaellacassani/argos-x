# Argos X — Mapa Operacional

> Última atualização: 17/03/2026

---

## 1. Visão Geral

**O que é:** SaaS B2B — CRM de vendas com Inteligência Artificial integrada ao WhatsApp.

**Posicionamento:** "Seu time de vendas com IA no WhatsApp." Plataforma que automatiza atendimento, qualificação, follow-up e agendamento de reuniões via agentes de IA conversacionais.

**Público-alvo:** PMEs brasileiras que vendem via WhatsApp — especialmente quem depende de atendimento consultivo ou volume de leads.

**Sites:**
- 🌐 Institucional/App: [https://argosx.com.br](https://argosx.com.br)
- 🚀 Landing Page de Aquisição: [https://argosx.gomktboost.com](https://argosx.gomktboost.com)

---

## 2. Frentes de Negócio

O Argos X opera como **produto único** com monetização por planos recorrentes + add-ons.

### 2.1 Produto Principal — CRM com IA para WhatsApp

| Item | Detalhe |
|------|---------|
| **O que vende** | Assinatura mensal do CRM (SaaS) com agentes de IA, funil de vendas, campanhas em massa, integrações WhatsApp/Instagram/Facebook, calendário com Google Meet, e-mail integrado |
| **Modelo de receita** | Recorrência mensal (MRR) via Stripe |
| **Moeda** | BRL (Real brasileiro) |

### 2.2 Planos e Preços

| Plano | Preço/mês | Leads | WhatsApp | Usuários | Interações IA/mês |
|-------|-----------|-------|----------|----------|--------------------|
| **Gratuito** (trial 7 dias) | R$ 0 | 300 | 1 | 1 | 100 |
| **Essencial** | R$ 47,90 | 300 | 1 | 1 | 100 |
| **Negócio** | R$ 97,90 | 2.000 | 3 | 1 (+R$37/extra) | 500 |
| **Escala** | R$ 197,90 | Ilimitados | Ilimitadas | 3 (+R$57/extra) | 2.000 |

### 2.3 Add-ons — Pacotes de Leads

| Pacote | Preço/mês |
|--------|-----------|
| +1.000 leads | R$ 17 |
| +5.000 leads | R$ 47 |
| +20.000 leads | R$ 97 |
| +50.000 leads | R$ 197 |

*(Status: "Em breve" — ainda não ativado no Stripe)*

---

## 3. Ticket Médio e LTV (Estimativas)

| Métrica | Valor estimado | Notas |
|---------|---------------|-------|
| **Ticket médio** | ~R$ 115/mês | Média ponderada considerando mix 50% Essencial, 35% Negócio, 15% Escala |
| **Churn estimado** | 8-12%/mês | Típico de SaaS SMB Brasil no estágio atual (pré-product-market fit) |
| **LTV estimado** | R$ 960 – R$ 1.440 | Baseado em lifetime de 8-12 meses com ticket médio |
| **CAC alvo** | < R$ 150 | Para manter LTV/CAC > 6x |

---

## 4. Canal Principal de Aquisição

| Canal | Detalhe |
|-------|---------|
| **Primário** | **Meta Ads → Landing Page → Trial gratuito 7 dias** |
| **Landing page** | argosx.gomktboost.com — foco em conversão, CTA "Teste grátis por 7 dias" |
| **Rastreamento** | Meta Pixel integrado no produto (componente `MetaPixelLoader`) + UTM tracking |
| **Onboarding** | E-mail automático pós-cadastro (edge function `send-onboarding-email`) |
| **Secundário** | Tráfego orgânico via argosx.com.br |
| **Checkout** | Stripe Checkout com redirecionamento (edge function `create-checkout-session`) |

**Fluxo de aquisição:**
```
Meta Ads → Landing Page (gomktboost) → Cadastro (trial 7 dias) → Onboarding email → Ativação → Upgrade para plano pago
```

---

## 5. Maior Gargalo Atual

### 🔴 Ativação e conversão de trial → pagante

| Sinal | Dado |
|-------|------|
| Workspaces criados | 40+ |
| Pagantes (Stripe) | 0 |
| Taxa de conversão trial→pago | ~0% |

**Causas prováveis:**
1. **Fricção na ativação** — Conectar WhatsApp (Evolution API) exige configuração técnica; muitos desistem antes de ver valor
2. **Time-to-value longo** — Usuário precisa: conectar WhatsApp → criar agente de IA → receber leads → ver a IA respondendo. São muitos passos até o "aha moment"
3. **Falta de onboarding guiado** — Tour guiado existe (`GuidedTourOverlay`) mas pode não ser suficiente para guiar até a ativação completa
4. **Sem cadência de reengajamento** — Não há sequência automatizada de e-mails/WhatsApp durante o trial incentivando os próximos passos
5. **Proposta de valor não testada** — O ICP real ainda não foi validado; pode haver desalinhamento entre o público que chega via ads e o que realmente precisa do produto

---

## 6. Segmentos-Alvo

| Segmento | Dor principal | Fit com Argos X |
|----------|--------------|-----------------|
| **E-commerce** | Volume alto de mensagens no WhatsApp, atendimento lento | ⭐⭐⭐⭐ — IA responde 24h, qualifica e agenda |
| **Infoprodutores** | Leads de lançamento sem follow-up | ⭐⭐⭐⭐⭐ — Follow-up automático + funil |
| **Agências de marketing** | Clientes pedem CRM mas não têm | ⭐⭐⭐⭐ — White-label potencial |
| **Clínicas/Saúde** | Agendamento manual, no-show | ⭐⭐⭐⭐⭐ — Agendamento com Google Meet + lembretes IA |
| **Negócios locais** | Perdem leads por demora no WhatsApp | ⭐⭐⭐ — Simples mas eficaz |
| **Educação/Cursos** | Captação e nutrição de alunos | ⭐⭐⭐⭐ — Funil + campanhas |

---

## 7. Stack de Monetização

| Componente | Tecnologia |
|------------|-----------|
| **Pagamentos** | Stripe (checkout sessions + webhooks) |
| **Gestão de planos** | Tabela `workspaces` (plan_name, lead_limit, etc.) |
| **Controle de limites** | Hook `usePlanLimits` + campos na workspace |
| **Add-ons** | Tabela `lead_packs` (ainda não ativado) |
| **Admin/Master** | Painel admin para ajustar limites manualmente |
| **Secrets Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ESSENCIAL`, `STRIPE_PRICE_NEGOCIO`, `STRIPE_PRICE_ESCALA` |

---

## 8. Funcionalidades-Chave do Produto

- ✅ Agentes de IA conversacionais (GPT-5 Mini) com follow-up automático
- ✅ Funil de vendas Kanban com múltiplos funis
- ✅ Integração WhatsApp (Evolution API + Cloud API)
- ✅ Integração Instagram/Facebook (Meta Graph API)
- ✅ Campanhas em massa com agendamento
- ✅ Calendário com Google Calendar + Google Meet automático
- ✅ E-mail integrado (Gmail OAuth)
- ✅ Salesbots (fluxos automatizados no-code)
- ✅ Tags, filtros e qualificação automática
- ✅ Relatórios diários/semanais via WhatsApp
- ✅ Multi-workspace e multi-usuário com permissões
- ✅ Rastreamento Meta Pixel integrado
