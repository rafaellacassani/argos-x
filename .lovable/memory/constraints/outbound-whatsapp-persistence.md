---
name: Outbound WhatsApp Persistence
description: Outbound WA messages MUST be persisted server-side by `evolution-api/send-{text,media,audio}` edge function with service role. NEVER insert from client (RLS blocks super admins viewing other workspaces via ?admin_ws=).
type: constraint
---
**Why:** When a super admin (e.g. Argos X) sends a message in a client workspace via `?admin_ws=`, the user is NOT a member of that workspace. A client-side `INSERT INTO whatsapp_messages` fails silently due to RLS, the message goes out via WhatsApp but disappears from the chat UI on reload.

**How to apply:**
- The `evolution-api` edge function resolves `workspace_id` from `instance_name` and persists each outbound message with the service-role client (`supabaseAdmin`).
- DO NOT add a client-side `supabase.from('whatsapp_messages').insert(...)` for outbound messages in `Chats.tsx` or any other component. The webhook will also receive a copy from Evolution and dedup will absorb it.
- This applies to ALL send rotues: send-text, send-media, send-audio. Add new send routes the same way.
