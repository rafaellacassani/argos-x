-- Create table for automatic tag rules based on first message content
CREATE TABLE public.tag_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_phrase TEXT NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tag_rules ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations (matching existing pattern)
CREATE POLICY "Allow all on tag_rules" 
ON public.tag_rules 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tag_rules_updated_at
BEFORE UPDATE ON public.tag_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_tag_rules_active ON public.tag_rules(is_active) WHERE is_active = true;