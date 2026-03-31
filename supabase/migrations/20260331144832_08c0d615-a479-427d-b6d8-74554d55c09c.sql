-- Fix workspaces that were incorrectly blocked due to trial_end being NULL
-- Set trial_end to 7 days from workspace creation and unblock them
UPDATE public.workspaces 
SET 
  trial_end = created_at + interval '7 days',
  blocked_at = NULL
WHERE plan_type = 'trialing' 
  AND trial_end IS NULL 
  AND blocked_at IS NOT NULL;

-- Also fix any trialing workspaces with NULL trial_end that haven't been blocked yet
UPDATE public.workspaces 
SET trial_end = created_at + interval '7 days'
WHERE plan_type = 'trialing' 
  AND trial_end IS NULL 
  AND blocked_at IS NULL;