ALTER TABLE public.reactivation_cadence_config 
  ALTER COLUMN cadence_days SET DEFAULT '[-2, -1, 0, 3, 7]'::jsonb;