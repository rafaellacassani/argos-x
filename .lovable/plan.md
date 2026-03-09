

## Diagnosis: SalesBot Not Triggering

### Root Cause Found

After analyzing the webhook logs and code, the issue is clear:

1. **The webhook IS receiving events** from the `ananutri3` instance (confirmed in logs at 18:40 and 18:42)
2. **But NO logs appear after the initial receipt** -- not even "MSG from" or "Skipping event"
3. The only code path that returns silently (without any log) is the **`fromMe` filter** at line 634

This means ALL webhook events arriving are outbound messages (`fromMe: true`). When you send FROM the phone connected to the `ananutri3` instance, Evolution API echoes those as `messages.upsert` with `fromMe: true`, and they get silently discarded.

**Key question:** When you tested, did you send FROM a different phone number TO Ana's number (+55 21 98787-6687)? Or did you send FROM Ana's phone?

### Additional Issue: Silent Filters

Even if the `fromMe` filter is working correctly, the code has no logging for several early-exit paths, making debugging impossible. The fix should add logging.

### Plan

1. **Add debug logging** to the `fromMe` filter, `data/instanceName` check, and other silent return paths in `whatsapp-webhook/index.ts` so we can see exactly why messages are being dropped
2. **Verify the test scenario** is correct: the message must come FROM a phone that is NOT the `ananutri3` instance (+55 21 98787-6687)

### Changes

**File: `supabase/functions/whatsapp-webhook/index.ts`**
- Add `console.log` at the `fromMe` filter (line 634): log that the message was skipped because it was outgoing
- Add `console.log` at the `data/instanceName` null check (line 625): log missing data
- These are small additions (2-3 lines) that will make future debugging instant

### How to Test

After deploying, send a WhatsApp message FROM a different phone (not Ana's +55 21 98787-6687) TO Ana's number. The logs should now show either:
- "Skipped: fromMe" -- confirming the message direction issue
- "MSG from..." followed by bot matching logs -- confirming the bot flow is executing

