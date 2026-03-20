

## Fix: "Apagar para todos" not showing in Chat

### Root Cause

Two issues prevent "Apagar para todos" from appearing:

1. **1-hour time window too restrictive** — The current code only shows the option for messages sent within the last hour. WhatsApp actually extended this window to ~48 hours. Messages older than 1 hour won't show the option at all.

2. **WABA/Meta instances completely blocked** — The code passes `onDeleteForEveryone={undefined}` for Meta instances, so the option never appears for WABA connections.

### Changes (minimal, only this fix)

**File: `src/components/chat/MessageBubble.tsx`**
- Change the edit/delete window from 1 hour (3600s) to 48 hours (172800s) to match WhatsApp's current policy
- Allow "Apagar para todos" for all instance types (remove `!isMeta` restriction from `canDeleteForEveryone`)

**File: `src/pages/Chats.tsx`**
- Pass `handleDeleteForEveryone` for Meta instances too (remove the `!selectedChat?.isMeta ?` conditional)
- In `handleDeleteForEveryone`, add Meta support: for Meta instances, call the Meta Graph API delete endpoint; for Evolution instances, use existing logic

**File: `supabase/functions/meta-send-message/index.ts`** (if needed)
- Add a delete message route using Meta Graph API: `DELETE /{message-id}` (Meta supports deleting business-sent messages)

### Summary
- Extend time window from 1h → 48h
- Enable "Apagar para todos" for both WhatsApp and WABA instances
- No other features or files touched

