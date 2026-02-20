
-- 1. Add plan columns to workspaces
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS plan_name text DEFAULT 'semente',
ADD COLUMN IF NOT EXISTS lead_limit integer DEFAULT 300,
ADD COLUMN IF NOT EXISTS extra_leads integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_limit integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS user_limit integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS ai_interactions_limit integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS ai_interactions_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_reset_at timestamptz DEFAULT now();

-- 2. Create lead_packs table
CREATE TABLE IF NOT EXISTS public.lead_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  pack_size integer NOT NULL,
  price_paid numeric(10,2),
  stripe_item_id text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lead_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage lead_packs"
  ON public.lead_packs FOR ALL
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- 3. Seed existing workspaces
UPDATE public.workspaces SET
  plan_name = 'trial',
  lead_limit = 300,
  extra_leads = 0,
  whatsapp_limit = 1,
  user_limit = 1,
  ai_interactions_limit = 100
WHERE plan_type IN ('trial_manual', 'trialing');

UPDATE public.workspaces SET
  plan_name = 'semente',
  lead_limit = 300,
  extra_leads = 0,
  whatsapp_limit = 1,
  user_limit = 1,
  ai_interactions_limit = 100
WHERE plan_type = 'active' AND (plan_name IS NULL OR plan_name = 'semente');
