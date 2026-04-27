
CREATE OR REPLACE FUNCTION public.increment_ai_interactions(_workspace_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.workspaces
  SET ai_interactions_used = COALESCE(ai_interactions_used, 0) + 1
  WHERE id = _workspace_id
  RETURNING ai_interactions_used;
$$;

CREATE OR REPLACE FUNCTION public.reset_ai_interactions_monthly()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.workspaces SET ai_interactions_used = 0;
$$;
