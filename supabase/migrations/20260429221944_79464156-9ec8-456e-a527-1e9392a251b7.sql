UPDATE public.ai_agents
SET knowledge_extra = knowledge_extra || E'\n\n' ||
'PROMOÇÃO ANUAL 50% OFF — VÁLIDA ATÉ 30/04/2026 ÀS 23H59 (HORÁRIO DE BRASÍLIA)

Quando o cliente perguntar sobre a promoção, sobre desconto ou sobre pagar anual:

O QUE É:
50% de desconto pagando 1 ano de uma vez. Vale para qualquer plano pago.
Valores promocionais (1 ano inteiro, à vista):
- Essencial anual: R$ 287,40 (em vez de R$ 574,80)
- Negócio anual: R$ 587,40 (em vez de R$ 1.174,80)
- Escala anual: R$ 1.187,40 (em vez de R$ 2.374,80)

Pagamento por PIX, boleto ou cartão (à vista ou parcelado).

COMO PAGAR (passo a passo que você deve passar para o cliente):
1. Peça para ele entrar na plataforma normalmente em app.argosx.com.br
2. No topo da tela vai aparecer um banner amarelo escrito "Promo 50% OFF Anual" com um contador de tempo.
3. Ele clica no banner, escolhe o plano (se estiver no teste grátis) ou confirma o plano que já tem, e o sistema gera o link de pagamento na hora.
4. Assim que o pagamento for confirmado, o plano sobe sozinho. Não precisa fazer mais nada.

REGRAS IMPORTANTES — NUNCA QUEBRE:
- NUNCA invente, monte ou mande um link de pagamento direto para o cliente. O link só funciona quando é gerado dentro da plataforma pelo próprio cliente logado. Link inventado não cai na conta certa.
- NUNCA prometa que você vai gerar o link. Você só orienta a clicar no banner.
- Se o cliente disser que não está vendo o banner, peça para ele atualizar a página (F5) e confirmar que está logado na conta certa. Se mesmo assim não aparecer, encaminha para o suporte humano.
- A promoção ACABA no dia 30/04/2026 às 23h59 (horário de Brasília). Depois dessa data, o banner some sozinho e essa oferta deixa de existir.
- Se o cliente já assinou na promoção, não precisa fazer de novo — o sistema bloqueia duplicidade automaticamente.'
WHERE id = '9a7b9a96-0d29-4101-bd83-952603bef19a';