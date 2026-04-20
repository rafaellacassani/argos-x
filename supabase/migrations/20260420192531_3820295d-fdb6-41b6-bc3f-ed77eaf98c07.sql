-- Restaura workspaces que foram cancelados erroneamente pelo bug do PAYMENT_DELETED durante trial ativo
-- Apenas workspaces com trial ainda futuro e assinatura no Asaas
UPDATE public.workspaces
SET 
  plan_type = 'trialing',
  subscription_status = 'trialing',
  blocked_at = NULL
WHERE payment_provider = 'asaas'
  AND plan_type IN ('canceled', 'blocked')
  AND blocked_at IS NOT NULL
  AND trial_end IS NOT NULL
  AND trial_end > now()
  AND asaas_subscription_id IS NOT NULL
  AND created_at > now() - interval '30 days';