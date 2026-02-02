-- Create table for individual sales per lead
CREATE TABLE public.lead_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_lead_sales_lead ON public.lead_sales(lead_id);

-- Enable RLS
ALTER TABLE public.lead_sales ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all on lead_sales" ON public.lead_sales
  FOR ALL USING (true) WITH CHECK (true);