CREATE OR REPLACE FUNCTION public.queue_stage_automations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto RECORD;
  _execute_at TIMESTAMPTZ;
  _bot RECORD;
  _stage_funnel_id UUID;
  _delay_minutes INT;
BEGIN
  -- Only process if stage_id changed (UPDATE) or new INSERT
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
    -- Queue after_time automations for the new stage
    FOR _auto IN
      SELECT id, trigger_delay_minutes
      FROM public.stage_automations
      WHERE stage_id = NEW.stage_id
        AND trigger = 'after_time'
        AND is_active = true
    LOOP
      _execute_at := now() + (COALESCE(_auto.trigger_delay_minutes, 60) * interval '1 minute');
      
      INSERT INTO public.stage_automation_queue (automation_id, lead_id, workspace_id, execute_at, status)
      VALUES (_auto.id, NEW.id, NEW.workspace_id, _execute_at, 'pending')
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Queue stage_change SalesBots
    SELECT funnel_id INTO _stage_funnel_id
    FROM public.funnel_stages WHERE id = NEW.stage_id;

    IF _stage_funnel_id IS NOT NULL THEN
      FOR _bot IN
        SELECT id, trigger_config
        FROM public.salesbots
        WHERE workspace_id = NEW.workspace_id
          AND trigger_type = 'stage_change'
          AND is_active = true
      LOOP
        -- Check if bot matches this funnel and stage
        IF (
          (_bot.trigger_config->>'funnel_id' IS NULL OR _bot.trigger_config->>'funnel_id' = '' OR (_bot.trigger_config->>'funnel_id')::uuid = _stage_funnel_id)
          AND
          (_bot.trigger_config->>'stage_id' IS NULL OR _bot.trigger_config->>'stage_id' = '' OR (_bot.trigger_config->>'stage_id')::uuid = NEW.stage_id)
        ) THEN
          _delay_minutes := COALESCE((_bot.trigger_config->>'delay_minutes')::int, 0);
          _execute_at := now() + (_delay_minutes * interval '1 minute');

          INSERT INTO public.salesbot_wait_queue (
            workspace_id, bot_id, lead_id, wait_node_id, target_node_id,
            condition_id, condition_type, execute_at, session_id, status
          ) VALUES (
            NEW.workspace_id, _bot.id, NEW.id, 'stage_change_trigger', 'start',
            'stage_trigger', 'timer', _execute_at,
            'stage_trigger_' || _bot.id || '_' || NEW.id || '_' || extract(epoch from now())::text,
            'pending'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$