
-- =============================================
-- MULTI-TENANT WORKSPACE MIGRATION
-- =============================================

-- 1. Create workspaces table
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 2. Create workspace_members table
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'seller',
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  invited_email text,
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to get user's workspace id
CREATE OR REPLACE FUNCTION public.get_user_workspace_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = _user_id
    AND accepted_at IS NOT NULL
  LIMIT 1
$$;

-- 4. Create default workspace for existing data
INSERT INTO public.workspaces (id, name, slug, created_by)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', '00000000-0000-0000-0000-000000000000');

-- 5. Add workspace_id to all data tables and populate with default

-- leads
ALTER TABLE public.leads ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.leads SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.leads ALTER COLUMN workspace_id SET NOT NULL;

-- funnels
ALTER TABLE public.funnels ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.funnels SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.funnels ALTER COLUMN workspace_id SET NOT NULL;

-- funnel_stages
ALTER TABLE public.funnel_stages ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.funnel_stages SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.funnel_stages ALTER COLUMN workspace_id SET NOT NULL;

-- lead_tags
ALTER TABLE public.lead_tags ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.lead_tags SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.lead_tags ALTER COLUMN workspace_id SET NOT NULL;

-- lead_tag_assignments
ALTER TABLE public.lead_tag_assignments ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.lead_tag_assignments SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.lead_tag_assignments ALTER COLUMN workspace_id SET NOT NULL;

-- lead_history
ALTER TABLE public.lead_history ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.lead_history SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.lead_history ALTER COLUMN workspace_id SET NOT NULL;

-- lead_sales
ALTER TABLE public.lead_sales ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.lead_sales SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.lead_sales ALTER COLUMN workspace_id SET NOT NULL;

-- ai_agents
ALTER TABLE public.ai_agents ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.ai_agents SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.ai_agents ALTER COLUMN workspace_id SET NOT NULL;

-- agent_memories
ALTER TABLE public.agent_memories ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.agent_memories SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.agent_memories ALTER COLUMN workspace_id SET NOT NULL;

-- agent_executions
ALTER TABLE public.agent_executions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.agent_executions SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.agent_executions ALTER COLUMN workspace_id SET NOT NULL;

-- salesbots
ALTER TABLE public.salesbots ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.salesbots SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.salesbots ALTER COLUMN workspace_id SET NOT NULL;

-- bot_execution_logs
ALTER TABLE public.bot_execution_logs ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.bot_execution_logs SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.bot_execution_logs ALTER COLUMN workspace_id SET NOT NULL;

-- whatsapp_instances
ALTER TABLE public.whatsapp_instances ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.whatsapp_instances SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.whatsapp_instances ALTER COLUMN workspace_id SET NOT NULL;

-- meta_accounts
ALTER TABLE public.meta_accounts ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.meta_accounts SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.meta_accounts ALTER COLUMN workspace_id SET NOT NULL;

-- meta_pages
ALTER TABLE public.meta_pages ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.meta_pages SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.meta_pages ALTER COLUMN workspace_id SET NOT NULL;

-- meta_conversations
ALTER TABLE public.meta_conversations ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.meta_conversations SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.meta_conversations ALTER COLUMN workspace_id SET NOT NULL;

-- scheduled_messages
ALTER TABLE public.scheduled_messages ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.scheduled_messages SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.scheduled_messages ALTER COLUMN workspace_id SET NOT NULL;

-- tag_rules
ALTER TABLE public.tag_rules ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.tag_rules SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.tag_rules ALTER COLUMN workspace_id SET NOT NULL;

-- notification_settings - add workspace_id too
ALTER TABLE public.notification_settings ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.notification_settings SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.notification_settings ALTER COLUMN workspace_id SET NOT NULL;

-- user_profiles - add workspace reference for convenience
-- (user_profiles stays global but we keep it for profile data)

-- 6. Create indexes for workspace_id on all tables
CREATE INDEX idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX idx_funnels_workspace ON public.funnels(workspace_id);
CREATE INDEX idx_funnel_stages_workspace ON public.funnel_stages(workspace_id);
CREATE INDEX idx_lead_tags_workspace ON public.lead_tags(workspace_id);
CREATE INDEX idx_lead_tag_assignments_workspace ON public.lead_tag_assignments(workspace_id);
CREATE INDEX idx_lead_history_workspace ON public.lead_history(workspace_id);
CREATE INDEX idx_lead_sales_workspace ON public.lead_sales(workspace_id);
CREATE INDEX idx_ai_agents_workspace ON public.ai_agents(workspace_id);
CREATE INDEX idx_agent_memories_workspace ON public.agent_memories(workspace_id);
CREATE INDEX idx_agent_executions_workspace ON public.agent_executions(workspace_id);
CREATE INDEX idx_salesbots_workspace ON public.salesbots(workspace_id);
CREATE INDEX idx_bot_execution_logs_workspace ON public.bot_execution_logs(workspace_id);
CREATE INDEX idx_whatsapp_instances_workspace ON public.whatsapp_instances(workspace_id);
CREATE INDEX idx_meta_accounts_workspace ON public.meta_accounts(workspace_id);
CREATE INDEX idx_meta_pages_workspace ON public.meta_pages(workspace_id);
CREATE INDEX idx_meta_conversations_workspace ON public.meta_conversations(workspace_id);
CREATE INDEX idx_scheduled_messages_workspace ON public.scheduled_messages(workspace_id);
CREATE INDEX idx_tag_rules_workspace ON public.tag_rules(workspace_id);
CREATE INDEX idx_notification_settings_workspace ON public.notification_settings(workspace_id);
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- 7. RLS policies for workspaces table
CREATE POLICY "Users can view their own workspaces"
ON public.workspaces FOR SELECT
USING (id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create workspaces"
ON public.workspaces FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Workspace admins can update"
ON public.workspaces FOR UPDATE
USING (id IN (
  SELECT workspace_id FROM public.workspace_members 
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- 8. RLS policies for workspace_members table
CREATE POLICY "Members can view their workspace members"
ON public.workspace_members FOR SELECT
USING (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Admins can manage workspace members"
ON public.workspace_members FOR ALL
USING (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members 
  WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Users can insert themselves as members"
ON public.workspace_members FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 9. Drop old RLS policies and create new workspace-scoped ones

-- leads
DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.leads;
CREATE POLICY "Workspace members can manage leads"
ON public.leads FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- funnels
DROP POLICY IF EXISTS "Authenticated users can manage funnels" ON public.funnels;
CREATE POLICY "Workspace members can manage funnels"
ON public.funnels FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- funnel_stages
DROP POLICY IF EXISTS "Authenticated users can manage funnel_stages" ON public.funnel_stages;
CREATE POLICY "Workspace members can manage funnel_stages"
ON public.funnel_stages FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- lead_tags
DROP POLICY IF EXISTS "Authenticated users can manage lead_tags" ON public.lead_tags;
CREATE POLICY "Workspace members can manage lead_tags"
ON public.lead_tags FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- lead_tag_assignments
DROP POLICY IF EXISTS "Authenticated users can manage lead_tag_assignments" ON public.lead_tag_assignments;
CREATE POLICY "Workspace members can manage lead_tag_assignments"
ON public.lead_tag_assignments FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- lead_history
DROP POLICY IF EXISTS "Authenticated users can manage lead_history" ON public.lead_history;
CREATE POLICY "Workspace members can manage lead_history"
ON public.lead_history FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- lead_sales
DROP POLICY IF EXISTS "Authenticated users can manage lead_sales" ON public.lead_sales;
CREATE POLICY "Workspace members can manage lead_sales"
ON public.lead_sales FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- ai_agents
DROP POLICY IF EXISTS "Authenticated users can manage ai_agents" ON public.ai_agents;
CREATE POLICY "Workspace members can manage ai_agents"
ON public.ai_agents FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- agent_memories
DROP POLICY IF EXISTS "Authenticated users can manage agent_memories" ON public.agent_memories;
CREATE POLICY "Workspace members can manage agent_memories"
ON public.agent_memories FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- agent_executions
DROP POLICY IF EXISTS "Authenticated users can manage agent_executions" ON public.agent_executions;
CREATE POLICY "Workspace members can manage agent_executions"
ON public.agent_executions FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- salesbots
DROP POLICY IF EXISTS "Authenticated users can manage salesbots" ON public.salesbots;
CREATE POLICY "Workspace members can manage salesbots"
ON public.salesbots FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- bot_execution_logs
DROP POLICY IF EXISTS "Authenticated users can manage bot_execution_logs" ON public.bot_execution_logs;
CREATE POLICY "Workspace members can manage bot_execution_logs"
ON public.bot_execution_logs FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- whatsapp_instances
DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_instances" ON public.whatsapp_instances;
CREATE POLICY "Workspace members can manage whatsapp_instances"
ON public.whatsapp_instances FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- meta_accounts
DROP POLICY IF EXISTS "Admins can manage meta_accounts" ON public.meta_accounts;
CREATE POLICY "Workspace members can manage meta_accounts"
ON public.meta_accounts FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- meta_pages
DROP POLICY IF EXISTS "Admins can manage meta_pages" ON public.meta_pages;
DROP POLICY IF EXISTS "Authenticated users can read meta_pages" ON public.meta_pages;
CREATE POLICY "Workspace members can manage meta_pages"
ON public.meta_pages FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- meta_conversations
DROP POLICY IF EXISTS "Authenticated users can manage meta_conversations" ON public.meta_conversations;
CREATE POLICY "Workspace members can manage meta_conversations"
ON public.meta_conversations FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- scheduled_messages
DROP POLICY IF EXISTS "Authenticated users can manage scheduled_messages" ON public.scheduled_messages;
CREATE POLICY "Workspace members can manage scheduled_messages"
ON public.scheduled_messages FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- tag_rules
DROP POLICY IF EXISTS "Authenticated users can manage tag_rules" ON public.tag_rules;
CREATE POLICY "Workspace members can manage tag_rules"
ON public.tag_rules FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- notification_settings - update policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Admins can manage all settings" ON public.notification_settings;
CREATE POLICY "Workspace members can manage notification_settings"
ON public.notification_settings FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- user_profiles - keep existing policies (global profiles)
-- user_roles - keep existing policies (global roles, will be deprecated in favor of workspace_members)
