-- Create enum for platform type
CREATE TYPE meta_platform AS ENUM ('facebook', 'instagram', 'both');

-- Table to store connected Meta accounts (user-level tokens)
CREATE TABLE public.meta_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policy (public access for now, can be restricted later with auth)
CREATE POLICY "Allow all on meta_accounts" 
ON public.meta_accounts 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_meta_accounts_updated_at
BEFORE UPDATE ON public.meta_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Table to store Facebook Pages and Instagram accounts
CREATE TABLE public.meta_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_account_id UUID NOT NULL REFERENCES public.meta_accounts(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  instagram_account_id TEXT,
  instagram_username TEXT,
  platform meta_platform NOT NULL DEFAULT 'facebook',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all on meta_pages" 
ON public.meta_pages 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_meta_pages_updated_at
BEFORE UPDATE ON public.meta_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_meta_pages_page_id ON public.meta_pages(page_id);
CREATE INDEX idx_meta_pages_instagram_account_id ON public.meta_pages(instagram_account_id);