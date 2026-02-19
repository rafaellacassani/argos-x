
-- Add missing columns to lead_sales
ALTER TABLE public.lead_sales
  ADD COLUMN IF NOT EXISTS sale_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Backfill sale_date from created_at for existing rows
UPDATE public.lead_sales SET sale_date = (created_at AT TIME ZONE 'UTC')::date WHERE sale_date = CURRENT_DATE AND created_at < now() - interval '1 day';

-- Add trigger for updated_at
CREATE TRIGGER update_lead_sales_updated_at
  BEFORE UPDATE ON public.lead_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
