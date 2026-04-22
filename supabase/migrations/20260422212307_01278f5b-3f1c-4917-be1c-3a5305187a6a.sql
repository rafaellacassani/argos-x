-- 1. Soft delete column on workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workspaces_archived_at
  ON public.workspaces (archived_at) WHERE archived_at IS NOT NULL;

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS public.cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  trigger_source text NOT NULL DEFAULT 'cron',
  archived_count integer NOT NULL DEFAULT 0,
  deleted_count integer NOT NULL DEFAULT 0,
  archived_workspace_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_workspace_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

ALTER TABLE public.cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view cleanup_log"
  ON public.cleanup_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Reactivation watch list
CREATE TABLE IF NOT EXISTS public.reactivation_watch (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  archive_deadline timestamptz NOT NULL,
  contact_attempts integer NOT NULL DEFAULT 0,
  last_contact_at timestamptz,
  notes text
);

ALTER TABLE public.reactivation_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage reactivation_watch"
  ON public.reactivation_watch FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));