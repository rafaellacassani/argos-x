
-- Rename column and convert existing hours to minutes
ALTER TABLE public.stage_automations RENAME COLUMN trigger_delay_hours TO trigger_delay_minutes;

-- Convert existing data: hours -> minutes
UPDATE public.stage_automations SET trigger_delay_minutes = trigger_delay_minutes * 60 WHERE trigger_delay_minutes > 0;
