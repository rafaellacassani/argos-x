
-- Calendly connections table
CREATE TABLE public.calendly_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  api_token TEXT NOT NULL,
  calendly_user_uri TEXT,
  calendly_email TEXT,
  scheduling_url TEXT,
  default_event_type_uri TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.calendly_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their workspace Calendly connection"
ON public.calendly_connections FOR SELECT TO authenticated
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Admins can insert Calendly connection"
ON public.calendly_connections FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can update Calendly connection"
ON public.calendly_connections FOR UPDATE TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete Calendly connection"
ON public.calendly_connections FOR DELETE TO authenticated
USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_calendly_connections_updated_at
BEFORE UPDATE ON public.calendly_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Feature flag table
CREATE TABLE public.calendly_allowed_workspaces (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE PRIMARY KEY,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled_by TEXT
);

ALTER TABLE public.calendly_allowed_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can check if Calendly is allowed"
ON public.calendly_allowed_workspaces FOR SELECT TO authenticated
USING (true);

-- Pre-populate with Argos X and ECX Company
INSERT INTO public.calendly_allowed_workspaces (workspace_id, enabled_by) VALUES
  ('41efdc6d-d4ba-4589-9761-7438a5911d57', 'admin'),
  ('6a8540c9-6eb5-42ce-8d20-960002d85bac', 'admin');
