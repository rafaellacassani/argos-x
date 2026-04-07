
-- agent_executions
DROP POLICY IF EXISTS "Workspace members can manage agent_executions" ON agent_executions;
CREATE POLICY "Workspace members can manage agent_executions" ON agent_executions FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- agent_followup_queue
DROP POLICY IF EXISTS "Workspace members can manage agent_followup_queue" ON agent_followup_queue;
CREATE POLICY "Workspace members can manage agent_followup_queue" ON agent_followup_queue FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- agent_memories
DROP POLICY IF EXISTS "Workspace members can manage agent_memories" ON agent_memories;
CREATE POLICY "Workspace members can manage agent_memories" ON agent_memories FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- ai_agents
DROP POLICY IF EXISTS "Workspace members can manage ai_agents" ON ai_agents;
CREATE POLICY "Workspace members can manage ai_agents" ON ai_agents FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- alert_log
DROP POLICY IF EXISTS "Workspace members can view alert_log" ON alert_log;
CREATE POLICY "Workspace members can view alert_log" ON alert_log FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- bot_execution_logs
DROP POLICY IF EXISTS "Workspace members can manage bot_execution_logs" ON bot_execution_logs;
CREATE POLICY "Workspace members can manage bot_execution_logs" ON bot_execution_logs FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- calendar_events
DROP POLICY IF EXISTS "Workspace members can manage calendar_events" ON calendar_events;
CREATE POLICY "Workspace members can manage calendar_events" ON calendar_events FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- campaign_recipients
DROP POLICY IF EXISTS "Workspace members can manage campaign_recipients" ON campaign_recipients;
CREATE POLICY "Workspace members can manage campaign_recipients" ON campaign_recipients FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))) WITH CHECK (campaign_id IN (SELECT id FROM campaigns WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

-- campaigns
DROP POLICY IF EXISTS "Workspace members can manage campaigns" ON campaigns;
CREATE POLICY "Workspace members can manage campaigns" ON campaigns FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- clients
DROP POLICY IF EXISTS "Workspace members can view clients" ON clients;
DROP POLICY IF EXISTS "Workspace members can insert clients" ON clients;
DROP POLICY IF EXISTS "Workspace members can update clients" ON clients;
DROP POLICY IF EXISTS "Workspace members can delete clients" ON clients;
CREATE POLICY "Workspace members can view clients" ON clients FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members can insert clients" ON clients FOR INSERT WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members can update clients" ON clients FOR UPDATE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members can delete clients" ON clients FOR DELETE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- connection_audit_log
DROP POLICY IF EXISTS "Workspace members can view connection_audit_log" ON connection_audit_log;
CREATE POLICY "Workspace members can view connection_audit_log" ON connection_audit_log FOR SELECT TO authenticated USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- email_accounts
DROP POLICY IF EXISTS "Workspace members can view email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can insert own email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can update own email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Users can delete own email_accounts" ON email_accounts;
CREATE POLICY "Workspace members can view email_accounts" ON email_accounts FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
CREATE POLICY "Users can insert own email_accounts" ON email_accounts FOR INSERT WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND user_id = auth.uid());
CREATE POLICY "Users can update own email_accounts" ON email_accounts FOR UPDATE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND user_id = auth.uid());
CREATE POLICY "Users can delete own email_accounts" ON email_accounts FOR DELETE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND user_id = auth.uid());

-- emails
DROP POLICY IF EXISTS "Workspace members can view emails" ON emails;
DROP POLICY IF EXISTS "Workspace members can insert emails" ON emails;
DROP POLICY IF EXISTS "Workspace members can update emails" ON emails;
DROP POLICY IF EXISTS "Workspace members can delete emails" ON emails;
CREATE POLICY "Workspace members can view emails" ON emails FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members can insert emails" ON emails FOR INSERT WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members can update emails" ON emails FOR UPDATE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members can delete emails" ON emails FOR DELETE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- followup_campaign_contacts
DROP POLICY IF EXISTS "Workspace members can manage followup_campaign_contacts" ON followup_campaign_contacts;
CREATE POLICY "Workspace members can manage followup_campaign_contacts" ON followup_campaign_contacts FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- followup_campaigns
DROP POLICY IF EXISTS "Workspace members can manage followup_campaigns" ON followup_campaigns;
CREATE POLICY "Workspace members can manage followup_campaigns" ON followup_campaigns FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- funnel_stages
DROP POLICY IF EXISTS "Workspace members can manage funnel_stages" ON funnel_stages;
CREATE POLICY "Workspace members can manage funnel_stages" ON funnel_stages FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- funnels
DROP POLICY IF EXISTS "Workspace members can manage funnels" ON funnels;
CREATE POLICY "Workspace members can manage funnels" ON funnels FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- human_support_queue
DROP POLICY IF EXISTS "Workspace members can manage human_support_queue" ON human_support_queue;
CREATE POLICY "Workspace members can manage human_support_queue" ON human_support_queue FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_custom_field_definitions
DROP POLICY IF EXISTS "Workspace members can manage lead_custom_field_definitions" ON lead_custom_field_definitions;
CREATE POLICY "Workspace members can manage lead_custom_field_definitions" ON lead_custom_field_definitions FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_custom_field_values
DROP POLICY IF EXISTS "Workspace members can manage lead_custom_field_values" ON lead_custom_field_values;
CREATE POLICY "Workspace members can manage lead_custom_field_values" ON lead_custom_field_values FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_history
DROP POLICY IF EXISTS "Workspace members can manage lead_history" ON lead_history;
CREATE POLICY "Workspace members can manage lead_history" ON lead_history FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_packs
DROP POLICY IF EXISTS "Workspace members can manage lead_packs" ON lead_packs;
CREATE POLICY "Workspace members can manage lead_packs" ON lead_packs FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_proposals
DROP POLICY IF EXISTS "Workspace members can manage lead_proposals" ON lead_proposals;
CREATE POLICY "Workspace members can manage lead_proposals" ON lead_proposals FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_sales
DROP POLICY IF EXISTS "Workspace members can manage lead_sales" ON lead_sales;
CREATE POLICY "Workspace members can manage lead_sales" ON lead_sales FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_tag_assignments
DROP POLICY IF EXISTS "Workspace members can manage lead_tag_assignments" ON lead_tag_assignments;
CREATE POLICY "Workspace members can manage lead_tag_assignments" ON lead_tag_assignments FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- lead_tags
DROP POLICY IF EXISTS "Workspace members can manage lead_tags" ON lead_tags;
CREATE POLICY "Workspace members can manage lead_tags" ON lead_tags FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- leads
DROP POLICY IF EXISTS "Workspace members can manage leads" ON leads;
CREATE POLICY "Workspace members can manage leads" ON leads FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- member_permissions
DROP POLICY IF EXISTS "Members can read own permissions" ON member_permissions;
CREATE POLICY "Members can read own permissions" ON member_permissions FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- meta_conversations
DROP POLICY IF EXISTS "Workspace members can manage meta_conversations" ON meta_conversations;
CREATE POLICY "Workspace members can manage meta_conversations" ON meta_conversations FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- notification_preferences
DROP POLICY IF EXISTS "Admins can manage notification_preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Managers can manage notification_preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can view own notification_preferences" ON notification_preferences;
CREATE POLICY "Admins can manage notification_preferences" ON notification_preferences FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND is_workspace_admin(auth.uid(), workspace_id)) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "Managers can manage notification_preferences" ON notification_preferences FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND has_role(auth.uid(), 'manager'::app_role)) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users can view own notification_preferences" ON notification_preferences FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND user_profile_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));

-- notification_settings
DROP POLICY IF EXISTS "Workspace members can manage notification_settings" ON notification_settings;
CREATE POLICY "Workspace members can manage notification_settings" ON notification_settings FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- salesbots
DROP POLICY IF EXISTS "Workspace members can manage salesbots" ON salesbots;
CREATE POLICY "Workspace members can manage salesbots" ON salesbots FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- salesbot_wait_queue
DROP POLICY IF EXISTS "Workspace members can manage salesbot_wait_queue" ON salesbot_wait_queue;
CREATE POLICY "Workspace members can manage salesbot_wait_queue" ON salesbot_wait_queue FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- scheduled_messages
DROP POLICY IF EXISTS "Workspace members can manage scheduled_messages" ON scheduled_messages;
CREATE POLICY "Workspace members can manage scheduled_messages" ON scheduled_messages FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- stage_automations
DROP POLICY IF EXISTS "Workspace members can manage stage_automations" ON stage_automations;
CREATE POLICY "Workspace members can manage stage_automations" ON stage_automations FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- stage_automation_queue
DROP POLICY IF EXISTS "Workspace members can manage stage_automation_queue" ON stage_automation_queue;
CREATE POLICY "Workspace members can manage stage_automation_queue" ON stage_automation_queue FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- support_tickets
DROP POLICY IF EXISTS "Users can manage own tickets" ON support_tickets;
CREATE POLICY "Users can manage own tickets" ON support_tickets FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- support_messages
DROP POLICY IF EXISTS "Users can manage own ticket messages" ON support_messages;
CREATE POLICY "Users can manage own ticket messages" ON support_messages FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- tag_rules
DROP POLICY IF EXISTS "Workspace members can manage tag_rules" ON tag_rules;
CREATE POLICY "Workspace members can manage tag_rules" ON tag_rules FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- whatsapp_instances
DROP POLICY IF EXISTS "Users can view own or admin view instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Owner or admin can update instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Owner or admin can delete instances" ON whatsapp_instances;
CREATE POLICY "Users can view own or admin view instances" ON whatsapp_instances FOR SELECT USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id) OR has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "Owner or admin can update instances" ON whatsapp_instances FOR UPDATE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id)));
CREATE POLICY "Owner or admin can delete instances" ON whatsapp_instances FOR DELETE USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id)));

-- whatsapp_messages
DROP POLICY IF EXISTS "Workspace members can manage whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Workspace members can manage whatsapp_messages" ON whatsapp_messages FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- whatsapp_templates
DROP POLICY IF EXISTS "Workspace members can manage whatsapp_templates" ON whatsapp_templates;
CREATE POLICY "Workspace members can manage whatsapp_templates" ON whatsapp_templates FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
