-- Desbloqueia workspace b4bd099c-46b1-45bb-82e9-ca9110ad3aa8 (amarques1980@hotmail.com)
-- Cliente pagou mensal Escala R$ 197,90 (pay_fwozjfjmj3w8376q RECEIVED em 29/04).
-- Boleto OVERDUE da promo anual (pay_cgaduisgi93la09t R$ 1.187,40) foi cancelado no Asaas
-- pois ele NÃO quis o anual, apenas o mensal.
UPDATE public.workspaces
SET plan_type = 'active',
    subscription_status = 'active',
    plan_name = 'escala',
    blocked_at = NULL,
    updated_at = now()
WHERE id = 'b4bd099c-46b1-45bb-82e9-ca9110ad3aa8';
