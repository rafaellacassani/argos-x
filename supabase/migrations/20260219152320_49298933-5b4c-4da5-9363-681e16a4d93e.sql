
-- Create lead_proposals table for quotes/budgets
CREATE TABLE public.lead_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  description TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add validation trigger for status instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_proposal_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'rejected', 'expired') THEN
    RAISE EXCEPTION 'Invalid proposal status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_proposal_status_trigger
BEFORE INSERT OR UPDATE ON public.lead_proposals
FOR EACH ROW EXECUTE FUNCTION public.validate_proposal_status();

-- Auto-update updated_at
CREATE TRIGGER update_lead_proposals_updated_at
BEFORE UPDATE ON public.lead_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.lead_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage lead_proposals"
ON public.lead_proposals FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_proposals;
