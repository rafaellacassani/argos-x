INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
VALUES (
  '1b77aa9e-22d6-4f96-a114-407761e9365b',
  'af1f4780-4524-44c8-a788-c6d9892220b3',
  'admin',
  now()
)
ON CONFLICT (workspace_id, user_id) DO UPDATE SET
  role = 'admin',
  accepted_at = COALESCE(workspace_members.accepted_at, now());

DELETE FROM public.workspace_members
WHERE workspace_id = '1b77aa9e-22d6-4f96-a114-407761e9365b'
  AND user_id = '2e5910f7-92b1-4efe-9cf6-10d01c5523d0';

UPDATE public.workspaces
SET created_by = 'af1f4780-4524-44c8-a788-c6d9892220b3',
    plan_type = 'trial_manual',
    subscription_status = 'trialing',
    blocked_at = NULL,
    trial_end = now() + interval '3 days'
WHERE id = '1b77aa9e-22d6-4f96-a114-407761e9365b';