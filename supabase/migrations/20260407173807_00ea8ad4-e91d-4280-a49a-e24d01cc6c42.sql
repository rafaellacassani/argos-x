
-- Fix overly permissive RLS on webhook_message_log
DROP POLICY IF EXISTS "Service role access on webhook_message_log" ON public.webhook_message_log;

CREATE POLICY "Workspace members can manage webhook_message_log"
ON public.webhook_message_log
FOR ALL
USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))
WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
