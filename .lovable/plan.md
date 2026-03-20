

## Fix: Pause/Resume codes not working for AI Agents

### Root Cause

When a seller types the pause code (e.g. "002") in WhatsApp, the message has `fromMe=true`. The webhook on line 643 **skips all `fromMe` messages immediately**, so the pause code never reaches the `ai-agent-chat` function where the pause/resume logic lives (lines 507-523).

### Solution

In `supabase/functions/whatsapp-webhook/index.ts`, **before** the `fromMe` skip (line 643), add a block that:

1. Extracts the message text from `fromMe` messages
2. Looks up workspace by instance name
3. Finds the active AI agent for that workspace/instance
4. Checks if the message matches the agent's `pause_code` or `resume_keyword`
5. If it matches `pause_code` → set `is_paused = true` on the matching `agent_memories` row and cancel pending follow-ups
6. If it matches `resume_keyword` → set `is_paused = false` on the matching `agent_memories` row
7. Then continue with the normal `fromMe` skip (don't process it as an inbound message)

### File changed

**`supabase/functions/whatsapp-webhook/index.ts`** — Add ~50 lines between the current line 642 and 643, wrapping the pause/resume check inside the `if (fromMe)` block before `return`.

### What is NOT touched

Everything else. No frontend changes. No other edge functions. No database changes.

