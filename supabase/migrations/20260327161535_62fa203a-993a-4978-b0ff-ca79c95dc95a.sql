
-- Create salesbot-media bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('salesbot-media', 'salesbot-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload salesbot media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'salesbot-media');

-- Allow public read access
CREATE POLICY "Public read access for salesbot media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'salesbot-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete salesbot media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'salesbot-media');
