
CREATE TABLE public.support_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  queue_item_id uuid NOT NULL REFERENCES public.human_support_queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_notes_queue_item ON public.support_notes(queue_item_id);

ALTER TABLE public.support_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage support_notes"
  ON public.support_notes FOR ALL
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_notes;
