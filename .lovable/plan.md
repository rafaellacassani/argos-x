

# Fix: Lead Deletion Blocked by Foreign Key Constraint

## Root Cause

The `agent_executions` table has a foreign key `agent_executions_lead_id_fkey` referencing `leads` with `NO ACTION` on delete. When a client tries to delete a lead that has AI agent execution history, PostgreSQL blocks the delete with a foreign key violation error.

All 14 other tables referencing `leads` correctly use `CASCADE` or `SET NULL`, but `agent_executions` was missed.

## Fix

**Single database migration** to alter the foreign key constraint:

```sql
ALTER TABLE public.agent_executions
  DROP CONSTRAINT agent_executions_lead_id_fkey,
  ADD CONSTRAINT agent_executions_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id)
    ON DELETE SET NULL;
```

Using `SET NULL` (not CASCADE) because execution logs are valuable analytics data that should be preserved even after a lead is deleted. The `lead_id` column is already nullable.

No code changes needed — the `deleteLead` function in `useLeads.ts` is correct; it's purely a database constraint issue.

