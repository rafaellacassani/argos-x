UPDATE workspaces 
SET plan_type = 'trial_manual', 
    trial_end = now() + interval '7 days', 
    blocked_at = NULL,
    subscription_status = 'trialing'
WHERE id = '59142dce-21dc-45fd-9aa3-b5c9ea9a1773';