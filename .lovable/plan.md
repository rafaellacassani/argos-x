

## Fix: Redirect to /cadastro during session refresh

### Problem
When idle for a while, Supabase auto-refreshes the auth token. This triggers `onAuthStateChange` → `user` changes → `loadWorkspace()` re-runs. During this re-run, `workspace` is momentarily `null` while `loading` stays `false` (because `initialLoadDone` is already `true`). `ProtectedRoute` sees `hasWorkspace = false` and redirects to `/cadastro`.

### Root cause
In `useWorkspace.tsx` line 76-78, loading is only set to `true` on the **first** load. Subsequent `loadWorkspace` calls skip setting loading, so `ProtectedRoute` sees `hasWorkspace = false` + `loading = false` = redirect.

### Fix (1 file)

**`src/hooks/useWorkspace.tsx`** — Always set loading during workspace reload, OR preserve the previous workspace value during refresh:

Option (safest): Do NOT clear `workspace` to `null` during reloads. Only update if new data arrives or if there's a confirmed "no workspace" state. Specifically:
- Remove the `setWorkspace(null)` / `setMembership(null)` at lines 198-199 and 203-204 when `initialLoadDone` is already `true`
- Or simpler: always set `loading = true` in `loadWorkspace` (remove the `if (!initialLoadDone)` guard at line 76), so `ProtectedRoute` shows a spinner instead of redirecting

The recommended approach: keep the previous workspace data during reloads, only clear on sign-out (`!user` at line 67). This avoids flicker and false redirects.

### Technical detail
- Lines 76-78: change `if (!initialLoadDone) { setLoading(true); }` to always `setLoading(true)`
- This ensures `ProtectedRoute` shows the spinner during workspace refresh instead of redirecting
- Alternative: keep workspace state intact during re-fetches by not calling `setWorkspace(null)` in catch/else blocks after initial load

### Impact
- No visual change for normal usage
- Eliminates the false redirect to `/cadastro` during token refresh
- No other files need changes

