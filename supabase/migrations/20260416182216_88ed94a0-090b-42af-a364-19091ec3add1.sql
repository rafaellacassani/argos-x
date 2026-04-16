-- Tabela de mensagens internas entre membros do workspace
CREATE TABLE public.internal_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_messages_workspace ON public.internal_messages(workspace_id);
CREATE INDEX idx_internal_messages_pair ON public.internal_messages(workspace_id, sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_internal_messages_receiver_unread ON public.internal_messages(workspace_id, receiver_id, read) WHERE read = false;

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Ver apenas mensagens onde o usuário é sender ou receiver, dentro de workspaces que ele participa
CREATE POLICY "Members view their internal messages"
ON public.internal_messages
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  AND (sender_id = auth.uid() OR receiver_id = auth.uid())
);

-- Apenas o próprio usuário pode enviar (sender = auth.uid()), e dentro de workspace válido
CREATE POLICY "Members send internal messages"
ON public.internal_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  AND receiver_id IN (
    SELECT user_id FROM public.workspace_members
    WHERE workspace_id = internal_messages.workspace_id
      AND accepted_at IS NOT NULL
  )
);

-- Apenas o destinatário pode atualizar (marcar como lida)
CREATE POLICY "Receiver marks as read"
ON public.internal_messages
FOR UPDATE
TO authenticated
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());

-- Realtime
ALTER TABLE public.internal_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;