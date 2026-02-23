-- Allow admin deletion of workspaces (used by admin-clients edge function via service_role)
-- The edge function uses service_role key which bypasses RLS, so no policy change needed.
-- But we need to ensure the workspaces table allows DELETE for service_role.
-- Since service_role bypasses RLS, we just need to make sure there's no DB-level restriction.
-- Actually, let's just add a permissive policy for completeness (service_role bypasses anyway).
SELECT 1; -- No-op, service_role bypasses RLS