
-- 1. Add personal_whatsapp to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS personal_whatsapp TEXT;

-- 2. Add alert_instance_name to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS alert_instance_name TEXT;

-- 3. Add instance_type to whatsapp_instances
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS instance_type TEXT NOT NULL DEFAULT 'commercial';

-- 4. Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- No-response alert (seller)
  no_response_enabled BOOLEAN DEFAULT true,
  no_response_minutes INTEGER DEFAULT 30,

  -- Daily report (seller)
  daily_report_enabled BOOLEAN DEFAULT true,
  daily_report_time TIME DEFAULT '19:00',

  -- Manager/admin report
  manager_report_enabled BOOLEAN DEFAULT false,
  manager_report_frequency TEXT DEFAULT 'daily',
  manager_report_time TIME DEFAULT '19:00',
  manager_report_day_of_week INTEGER DEFAULT 1,

  -- New lead alert (real-time)
  new_lead_alert_enabled BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_profile_id, workspace_id)
);

-- Validation trigger for no_response_minutes
CREATE OR REPLACE FUNCTION public.validate_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.no_response_minutes IS NOT NULL AND NEW.no_response_minutes NOT IN (10, 30, 60) THEN
    RAISE EXCEPTION 'no_response_minutes must be 10, 30 or 60';
  END IF;
  IF NEW.manager_report_frequency IS NOT NULL AND NEW.manager_report_frequency NOT IN ('daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'manager_report_frequency must be daily, weekly or monthly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_notification_preferences_trigger
BEFORE INSERT OR UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.validate_notification_preferences();

-- Validation trigger for instance_type
CREATE OR REPLACE FUNCTION public.validate_instance_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.instance_type NOT IN ('commercial', 'alerts') THEN
    RAISE EXCEPTION 'instance_type must be commercial or alerts';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_instance_type_trigger
BEFORE INSERT OR UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.validate_instance_type();

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_preferences
-- Admin can manage all in workspace
CREATE POLICY "Admins can manage notification_preferences"
ON public.notification_preferences
FOR ALL
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND is_workspace_admin(auth.uid(), workspace_id)
)
WITH CHECK (
  workspace_id = get_user_workspace_id(auth.uid())
  AND is_workspace_admin(auth.uid(), workspace_id)
);

-- Managers can manage sellers' and their own preferences
CREATE POLICY "Managers can manage notification_preferences"
ON public.notification_preferences
FOR ALL
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND has_role(auth.uid(), 'manager')
)
WITH CHECK (
  workspace_id = get_user_workspace_id(auth.uid())
  AND has_role(auth.uid(), 'manager')
);

-- Users can view their own preferences (read-only)
CREATE POLICY "Users can view own notification_preferences"
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND user_profile_id IN (
    SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
  )
);

-- Updated_at trigger
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
