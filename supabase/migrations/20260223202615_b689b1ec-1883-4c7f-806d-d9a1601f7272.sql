
-- Add logo_url column to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for workspace logos
INSERT INTO storage.buckets (id, name, public) VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to workspace-logos
CREATE POLICY "Authenticated users can upload workspace logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'workspace-logos' AND auth.role() = 'authenticated');

-- Allow public read access
CREATE POLICY "Public can view workspace logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'workspace-logos');

-- Allow owners to update/delete their logos
CREATE POLICY "Authenticated users can update workspace logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'workspace-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete workspace logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'workspace-logos' AND auth.role() = 'authenticated');
