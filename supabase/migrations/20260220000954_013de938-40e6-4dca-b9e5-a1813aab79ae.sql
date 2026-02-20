
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-attachments', 'campaign-attachments', true);

CREATE POLICY "Authenticated users can upload campaign attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'campaign-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view campaign attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-attachments');

CREATE POLICY "Authenticated users can delete campaign attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'campaign-attachments' AND auth.uid() IS NOT NULL);
