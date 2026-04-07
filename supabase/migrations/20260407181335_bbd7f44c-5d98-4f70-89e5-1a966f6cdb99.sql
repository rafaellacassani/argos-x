
UPDATE ai_agents SET is_active = false
WHERE is_active = true
AND workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE w.blocked_at IS NOT NULL 
  OR w.plan_type IN ('blocked', 'canceled')
  OR (w.plan_type IN ('trialing', 'trial_manual') AND w.trial_end IS NOT NULL AND w.trial_end < NOW())
);
