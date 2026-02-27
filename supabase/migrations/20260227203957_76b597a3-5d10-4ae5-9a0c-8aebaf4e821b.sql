
-- Table to track all client invitations (checkout links + free workspaces)
CREATE TABLE public.client_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'gratuito',
  invite_type TEXT NOT NULL DEFAULT 'checkout', -- 'checkout' or 'free'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed'
  checkout_url TEXT,
  stripe_customer_id TEXT,
  workspace_id UUID REFERENCES public.workspaces(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: only super admins can manage
ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_invites"
  ON public.client_invites
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
