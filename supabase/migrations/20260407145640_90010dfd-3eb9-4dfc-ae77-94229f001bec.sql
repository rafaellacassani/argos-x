
ALTER TABLE public.lead_tags DROP CONSTRAINT IF EXISTS lead_tags_name_key;
ALTER TABLE public.lead_tags ADD CONSTRAINT lead_tags_workspace_name_key UNIQUE (workspace_id, name);
