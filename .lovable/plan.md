
# Fix: Invited members landing on "Create Workspace" instead of Dashboard

## Problem
When an invited user (like Nathalia) accepts an invite and logs in, there's a race condition:
1. `useWorkspace` begins loading and calls the `accept-invite` edge function in the background
2. `ProtectedRoute` sees `hasWorkspace = false` during this loading and redirects to `/create-workspace`
3. The accept completes and the workspace IS loaded into state, but nothing on the `/create-workspace` page checks for this -- it just keeps showing the "Create Workspace" form

## Solution

Two changes to fix this:

### 1. CreateWorkspace page: redirect if workspace already exists
Add a check at the top of `CreateWorkspace.tsx`: if `hasWorkspace` is true (meaning the invite was accepted and workspace loaded), automatically redirect to `/dashboard`. Also show a loading spinner while the workspace is still loading (to give the accept-invite time to complete).

### 2. Clean up duplicate database records
The previous resend of Geisi's invite created orphaned records. These old entries (from the `@grupoecx.com` emails) with `accepted_at = null` should be removed to avoid confusion.

---

## Technical Details

### File: `src/pages/CreateWorkspace.tsx`
- Import `useWorkspace` fields: `hasWorkspace`, `loading`
- If `loading` is true, show a spinner (give accept-invite time to finish)
- If `hasWorkspace` is true, return `<Navigate to="/dashboard" replace />`
- Keep the form as fallback for users who genuinely need to create a workspace

### Database cleanup (SQL)
- Delete the 2 orphaned `workspace_members` rows with `accepted_at IS NULL` (IDs: `2b6b2314` and `a8f12359`)
- Delete the 2 orphaned `user_profiles` entries for the old `@grupoecx.com` auth users
- Delete the 2 orphaned `auth.users` entries (`671dd81c` and `7f0d39d6`)
