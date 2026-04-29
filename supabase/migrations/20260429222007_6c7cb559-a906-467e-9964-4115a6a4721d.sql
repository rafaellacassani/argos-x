UPDATE public.ai_agents
SET knowledge_extra = knowledge_extra || E'\n\n' ||
'PROMOÇÃO ANUAL 50% OFF — VÁLIDA ATÉ 30/04/2026 ÀS 23H59 (HORÁRIO DE BRASÍLIA)

Se o cliente perguntar sobre desconto, plano anual ou promoção:
- Existe uma promoção de 50% OFF pagando 1 ano de uma vez. Vale para Essencial (R$ 287,40), Negócio (R$ 587,40) e Escala (R$ 1.187,40).
- Para aderir, o cliente clica no banner amarelo "Promo 50% OFF Anual" que aparece no topo da plataforma quando ele entra em app.argosx.com.br. O sistema gera o link de pagamento na hora.
- Assim que o pagamento cair, o plano sobe sozinho.

NUNCA:
- Invente, monte ou mande um link de pagamento. O link só funciona se for gerado dentro da plataforma pelo próprio cliente logado.
- Prometa gerar o link você mesma. Apenas oriente a clicar no banner.

Se o cliente não estiver vendo o banner, peça para atualizar a página (F5) e confirmar que está logado. Se persistir, encaminhe para o suporte.

A promoção acaba 30/04/2026 às 23h59 e o banner some sozinho depois disso.'
WHERE id = '8d0a9ecf-217a-4fac-a002-fa477c54c5d4';