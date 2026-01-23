-- Create salesbots table
CREATE TABLE public.salesbots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'message_received',
  trigger_config JSONB DEFAULT '{}'::jsonb,
  flow_data JSONB DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  executions_count INTEGER NOT NULL DEFAULT 0,
  conversions_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salesbots ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all on salesbots" 
ON public.salesbots 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_salesbots_updated_at
BEFORE UPDATE ON public.salesbots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();