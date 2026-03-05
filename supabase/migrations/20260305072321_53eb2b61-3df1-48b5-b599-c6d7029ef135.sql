
ALTER TABLE public.campaigns 
  ADD COLUMN instance_names jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN last_instance_index integer DEFAULT 0;
