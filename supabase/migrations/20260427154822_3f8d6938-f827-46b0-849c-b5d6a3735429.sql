
-- Trigger preventivo: garante que todo workspace criado tenha o criador como admin em workspace_members
CREATE OR REPLACE FUNCTION public.ensure_workspace_creator_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
    VALUES (NEW.id, NEW.created_by, 'admin', now())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_workspace_creator_membership failed for workspace %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_workspace_creator_membership ON public.workspaces;

CREATE TRIGGER trg_ensure_workspace_creator_membership
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.ensure_workspace_creator_membership();
