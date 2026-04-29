---
name: Storage RLS Workspace Pattern
description: Storage bucket RLS policies MUST validate folder path against workspace_id, never workspace_members.id
type: constraint
---
# Storage RLS — Workspace Folder Pattern

**Rule:** All storage buckets that segregate files by workspace MUST use folder names = `workspace_id` (UUID), and RLS policies MUST validate via `public.get_user_workspace_ids(auth.uid())`.

**Why:** Using `workspace_members.id` (membership row UUID) instead of `workspace_id` causes 100% silent upload failures — Supabase Storage rejects the INSERT with no client-facing error. This already broke `agent-attachments` for all 171 workspaces (PetSonhos case, Apr 2026).

**Correct pattern (INSERT/SELECT/UPDATE/DELETE):**
```sql
CREATE POLICY "ws members can upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agent-attachments'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_user_workspace_ids(auth.uid())
  )
);
```

**Wrong (NEVER use):**
```sql
-- ❌ workspace_members.id is NOT the workspace_id
AND (storage.foldername(name))[1]::uuid IN (
  SELECT id FROM workspace_members WHERE user_id = auth.uid()
)
```

**Application side:** Always upload to path `${workspace_id}/${filename}` — never `${membership_id}/...`.

**Audit checklist when creating any new bucket:**
1. Folder[1] = workspace_id
2. RLS uses `get_user_workspace_ids(auth.uid())`
3. Test upload end-to-end with a non-admin member before shipping
