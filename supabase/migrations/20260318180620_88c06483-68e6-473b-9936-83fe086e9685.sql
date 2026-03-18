
-- Function to call fire-webhook edge function when lead stage changes
CREATE OR REPLACE FUNCTION public.fire_deal_stage_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url TEXT;
  _service_role_key TEXT;
  _from_stage RECORD;
  _to_stage RECORD;
BEGIN
  -- Only fire on actual stage change
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  -- Get secrets
  SELECT decrypted_secret INTO _supabase_url 
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _service_role_key 
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF _supabase_url IS NULL OR _service_role_key IS NULL THEN
    RAISE WARNING 'fire_deal_stage_changed: missing vault secrets';
    RETURN NEW;
  END IF;

  -- Get stage names
  SELECT id, name INTO _from_stage FROM funnel_stages WHERE id = OLD.stage_id;
  SELECT id, name INTO _to_stage FROM funnel_stages WHERE id = NEW.stage_id;

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/fire-webhook',
    body := json_build_object(
      'event_type', 'deal.stage_changed',
      'workspace_id', NEW.workspace_id,
      'data', json_build_object(
        'lead_id', NEW.id,
        'lead_name', NEW.name,
        'lead_phone', NEW.phone,
        'from_stage', json_build_object('id', OLD.stage_id, 'name', COALESCE(_from_stage.name, '')),
        'to_stage', json_build_object('id', NEW.stage_id, 'name', COALESCE(_to_stage.name, '')),
        'moved_at', now()
      )
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fire_deal_stage_changed failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_deal_stage_changed ON leads;
CREATE TRIGGER trigger_deal_stage_changed
  AFTER UPDATE OF stage_id ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fire_deal_stage_changed();
