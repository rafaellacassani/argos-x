DROP POLICY IF EXISTS "Users can upload agent attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view agent attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete agent attachments" ON storage.objects;

CREATE POLICY "Users can upload agent attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-attachments'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY "Users can view agent attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-attachments'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY "Users can delete agent attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'agent-attachments'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_workspace_ids(auth.uid()))
);

CREATE POLICY "Users can update agent attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agent-attachments'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.get_user_workspace_ids(auth.uid()))
);