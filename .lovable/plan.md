

## Analysis: Phone Number Normalization Strategy

### The Problem
Phone numbers enter the system from multiple sources (WhatsApp webhook, form webhook, manual creation, CSV import) and are stored inconsistently — sometimes with country code `55`, sometimes without. When downstream functions (campaigns, scheduled messages, alerts) try to send via Evolution API, numbers without `55` fail with "number not found" errors.

Currently, normalization (adding `55` prefix) is patched only in `process-campaigns`. But the same issue affects: `send-scheduled-messages`, `notify-new-lead`, `check-no-response-alerts`, `weekly-report`, `send-daily-reports`, `process-reactivation`, and any future function.

### Root Cause
The `whatsapp-webhook` already extracts phone numbers correctly from JIDs (which include country code), so WhatsApp-originated leads typically have `55`. But:
- **Form webhook**: stores raw digits from form input — no `55` normalization
- **Manual creation** (`useLeads.ts`): stores `phoneDigits` as-is (just strips non-digits)
- **CSV import**: stores raw phone digits

### Proposed Solution: Normalize at Every Entry Point

Rather than a database trigger (which could break existing data or cause side effects), the safest approach is to **add a shared `normalizePhone` function at each entry point** where leads are created/updated.

**Logic**: If phone has 10-11 digits (Brazilian DDD + number), prepend `55`. If already 12-13 digits starting with `55`, leave as-is.

```text
normalizePhone("27999887766")     → "5527999887766"
normalizePhone("5527999887766")   → "5527999887766"  (no change)
normalizePhone("+55 27 99988-7766") → "5527999887766"
normalizePhone("1234567890123456") → unchanged (international)
```

### Files to Modify

1. **`src/hooks/useLeads.ts`** — `createLead()` and `createLeadSilent()`: normalize `phoneDigits` before storing
2. **`src/components/contacts/ImportContactsDialog.tsx`** — normalize phone in CSV import before inserting
3. **`supabase/functions/form-webhook/index.ts`** — normalize after stripping non-digits
4. **`supabase/functions/whatsapp-webhook/index.ts`** — normalize `phoneNumber` before lead insert (mostly already correct from JID, but edge cases exist)
5. **`supabase/functions/prepare-campaign/index.ts`** — already patched, keep as safety net
6. **`supabase/functions/process-campaigns/index.ts`** — already patched, keep as safety net
7. **`supabase/functions/send-scheduled-messages/index.ts`** — add normalization before sending
8. **`supabase/functions/check-no-response-alerts/index.ts`** — add normalization (already does it partially)
9. **`supabase/functions/notify-new-lead/index.ts`** — add normalization
10. **`supabase/functions/send-daily-reports/index.ts`** — add normalization
11. **`supabase/functions/weekly-report/index.ts`** — add normalization
12. **`supabase/functions/process-reactivation/index.ts`** — already does it, verify consistency

### Implementation Details

**Shared normalize function** (duplicated in each edge function since they can't share imports):
```typescript
function normalizeBRPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    return "55" + digits;
  }
  return digits;
}
```

**Frontend version** (in `useLeads.ts` and `ImportContactsDialog.tsx`):
```typescript
function normalizeBRPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    return '55' + digits;
  }
  return digits;
}
```

**Priority**: Entry points (items 1-4) are the most important — they fix the root cause. Items 5-11 are safety nets at send time.

### What Won't Break
- Numbers from WhatsApp JIDs already have `55` → function is a no-op
- International numbers (not 10-11 digits) are untouched
- Existing leads with correct numbers are unaffected
- The `phone.like.%${last10digits}` dedup logic still works since we're only prepending

