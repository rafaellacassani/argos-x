
-- Make stage_id nullable so leads can exist as contacts without being in a funnel stage
ALTER TABLE public.leads ALTER COLUMN stage_id DROP NOT NULL;
