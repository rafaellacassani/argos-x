
-- Create alert_log table for tracking sent alerts
CREATE TABLE public.alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_preview TEXT
);

-- Validation trigger for alert_type
CREATE OR REPLACE FUNCTION public.validate_alert_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.alert_type NOT IN ('no_response', 'daily_report', 'weekly_report', 'monthly_report', 'new_lead') THEN
    RAISE EXCEPTION 'Invalid alert_type: %', NEW.alert_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_alert_type_trigger
  BEFORE INSERT OR UPDATE ON public.alert_log
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_alert_type();

-- Index for dedup lookups
CREATE INDEX idx_alert_log_lookup 
  ON public.alert_log(workspace_id, user_profile_id, alert_type, lead_id, sent_at);

-- Enable RLS
ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can view their workspace's logs
CREATE POLICY "Workspace members can view alert_log"
  ON public.alert_log
  FOR SELECT
  USING (workspace_id = get_user_workspace_id(auth.uid()));

-- RLS: only service role inserts (edge functions), but we need a permissive policy for that
-- Edge functions use service role key which bypasses RLS, so no INSERT policy needed for users

-- Enable pg_net extension for trigger-based HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function to call notify-new-lead edge function
CREATE OR REPLACE FUNCTION public.notify_new_lead_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url TEXT;
  _service_role_key TEXT;
BEGIN
  -- Get config from vault or env
  SELECT decrypted_secret INTO _supabase_url 
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _service_role_key 
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  
  IF _supabase_url IS NOT NULL AND _service_role_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _supabase_url || '/functions/v1/notify-new-lead',
      body := json_build_object('lead_id', NEW.id, 'workspace_id', NEW.workspace_id)::text,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_role_key
      )::jsonb
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fail silently - don't block lead creation
  RAISE WARNING 'notify_new_lead_trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on leads table
CREATE TRIGGER on_new_lead_notify
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_lead_trigger();
