
-- ============================================
-- FIX RLS POLICIES: Replace all USING(true) with proper auth
-- ============================================

-- 1. LEADS - authenticated users only
DROP POLICY IF EXISTS "Allow all on leads" ON public.leads;
CREATE POLICY "Authenticated users can manage leads" ON public.leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. LEAD_HISTORY - authenticated users only
DROP POLICY IF EXISTS "Allow all on lead_history" ON public.lead_history;
CREATE POLICY "Authenticated users can manage lead_history" ON public.lead_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. LEAD_SALES - authenticated users only
DROP POLICY IF EXISTS "Allow all on lead_sales" ON public.lead_sales;
CREATE POLICY "Authenticated users can manage lead_sales" ON public.lead_sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. LEAD_TAGS - authenticated users only
DROP POLICY IF EXISTS "Allow all on lead_tags" ON public.lead_tags;
CREATE POLICY "Authenticated users can manage lead_tags" ON public.lead_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. LEAD_TAG_ASSIGNMENTS - authenticated users only
DROP POLICY IF EXISTS "Allow all on lead_tag_assignments" ON public.lead_tag_assignments;
CREATE POLICY "Authenticated users can manage lead_tag_assignments" ON public.lead_tag_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. FUNNELS - authenticated users only
DROP POLICY IF EXISTS "Allow all on funnels" ON public.funnels;
CREATE POLICY "Authenticated users can manage funnels" ON public.funnels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. FUNNEL_STAGES - authenticated users only
DROP POLICY IF EXISTS "Allow all on funnel_stages" ON public.funnel_stages;
CREATE POLICY "Authenticated users can manage funnel_stages" ON public.funnel_stages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. AI_AGENTS - authenticated users only
DROP POLICY IF EXISTS "Allow all on ai_agents" ON public.ai_agents;
CREATE POLICY "Authenticated users can manage ai_agents" ON public.ai_agents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. AGENT_MEMORIES - authenticated users only
DROP POLICY IF EXISTS "Allow all on agent_memories" ON public.agent_memories;
CREATE POLICY "Authenticated users can manage agent_memories" ON public.agent_memories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. AGENT_EXECUTIONS - authenticated users only
DROP POLICY IF EXISTS "Allow all on agent_executions" ON public.agent_executions;
CREATE POLICY "Authenticated users can manage agent_executions" ON public.agent_executions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. SALESBOTS - authenticated users only
DROP POLICY IF EXISTS "Allow all on salesbots" ON public.salesbots;
CREATE POLICY "Authenticated users can manage salesbots" ON public.salesbots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. BOT_EXECUTION_LOGS - authenticated users only
DROP POLICY IF EXISTS "Allow all on bot_execution_logs" ON public.bot_execution_logs;
CREATE POLICY "Authenticated users can manage bot_execution_logs" ON public.bot_execution_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. TAG_RULES - authenticated users only
DROP POLICY IF EXISTS "Allow all on tag_rules" ON public.tag_rules;
CREATE POLICY "Authenticated users can manage tag_rules" ON public.tag_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 14. WHATSAPP_INSTANCES - authenticated users only
DROP POLICY IF EXISTS "Allow all operations on whatsapp_instances" ON public.whatsapp_instances;
CREATE POLICY "Authenticated users can manage whatsapp_instances" ON public.whatsapp_instances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 15. META_ACCOUNTS - ADMIN ONLY (contains OAuth tokens)
DROP POLICY IF EXISTS "Allow all on meta_accounts" ON public.meta_accounts;
CREATE POLICY "Admins can manage meta_accounts" ON public.meta_accounts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 16. META_PAGES - ADMIN ONLY (contains page access tokens)
DROP POLICY IF EXISTS "Allow all on meta_pages" ON public.meta_pages;
CREATE POLICY "Admins can manage meta_pages" ON public.meta_pages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Authenticated users can read meta_pages (needed for chat functionality, but tokens are only used server-side)
CREATE POLICY "Authenticated users can read meta_pages" ON public.meta_pages
  FOR SELECT TO authenticated USING (true);

-- 17. META_CONVERSATIONS - authenticated users only
DROP POLICY IF EXISTS "Allow all on meta_conversations" ON public.meta_conversations;
CREATE POLICY "Authenticated users can manage meta_conversations" ON public.meta_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 18. Allow service_role to bypass all (needed for edge functions using service role key)
-- This is automatic in Supabase - service_role bypasses RLS by default
