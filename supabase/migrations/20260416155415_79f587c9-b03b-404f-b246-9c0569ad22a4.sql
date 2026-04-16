
-- Add ticket_number column
ALTER TABLE public.human_support_queue
ADD COLUMN IF NOT EXISTS ticket_number integer;

-- Backfill existing rows with sequential numbers per workspace
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at ASC) AS rn
  FROM public.human_support_queue
)
UPDATE public.human_support_queue h
SET ticket_number = n.rn
FROM numbered n
WHERE h.id = n.id;

-- Create a function to auto-assign ticket_number on insert
CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _next_num integer;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO _next_num
  FROM public.human_support_queue
  WHERE workspace_id = NEW.workspace_id;
  
  NEW.ticket_number := _next_num;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign on insert
DROP TRIGGER IF EXISTS trg_assign_ticket_number ON public.human_support_queue;
CREATE TRIGGER trg_assign_ticket_number
BEFORE INSERT ON public.human_support_queue
FOR EACH ROW
WHEN (NEW.ticket_number IS NULL)
EXECUTE FUNCTION public.assign_ticket_number();
