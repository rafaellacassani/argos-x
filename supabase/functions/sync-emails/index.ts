import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  // Allow service role key
  if (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) return "__service__";
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function refreshAccessToken(accountId: string): Promise<string | null> {
  const { data: account } = await supabaseAdmin
    .from("email_accounts")
    .select("refresh_token, access_token, token_expiry")
    .eq("id", accountId)
    .single();

  if (!account) return null;

  // Check if token still valid
  if (new Date(account.token_expiry) > new Date(Date.now() + 60_000)) {
    return account.access_token;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    console.error("[sync-emails] Token refresh failed:", tokenData.error);
    return null;
  }

  const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("email_accounts")
    .update({ access_token: tokenData.access_token, token_expiry: newExpiry })
    .eq("id", accountId);

  return tokenData.access_token;
}

async function fetchGmailMessage(accessToken: string, messageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error("[sync-emails] Failed to fetch message:", messageId, errText);
    return null;
  }
  return await res.json();
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function decodeBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  if (payload.body?.data) {
    const decoded = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    if (payload.mimeType === "text/html") html = decoded;
    else text = decoded;
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "multipart/alternative" || part.mimeType === "multipart/mixed") {
        const sub = decodeBody(part);
        if (sub.text) text = sub.text;
        if (sub.html) html = sub.html;
      } else if (part.body?.data) {
        const decoded = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        if (part.mimeType === "text/html") html = decoded;
        else if (part.mimeType === "text/plain") text = decoded;
      }
    }
  }

  return { text, html };
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

function parseEmailList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(",").map(e => e.trim()).filter(Boolean);
}

function getFolder(labelIds: string[]): string {
  if (labelIds.includes("TRASH")) return "trash";
  if (labelIds.includes("DRAFT")) return "drafts";
  if (labelIds.includes("SENT")) return "sent";
  if (!labelIds.includes("INBOX")) return "archive";
  return "inbox";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const callerId = await getUserIdFromAuth(authHeader);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { emailAccountId } = body;

    if (!emailAccountId) {
      return new Response(JSON.stringify({ error: "emailAccountId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get account
    const { data: account, error: accErr } = await supabaseAdmin
      .from("email_accounts")
      .select("*")
      .eq("id", emailAccountId)
      .single();

    if (accErr || !account) {
      return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get valid access token
    const accessToken = await refreshAccessToken(emailAccountId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Failed to get access token" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch message list from Gmail
    const maxResults = account.sync_cursor ? 20 : 50;
    let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
    if (account.sync_cursor) {
      // Use history API for incremental sync
      const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${account.sync_cursor}&maxResults=50&historyTypes=messageAdded&historyTypes=messageDeleted&historyTypes=labelAdded&historyTypes=labelRemoved`;
      const historyRes = await fetch(historyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const messageIds = new Set<string>();

        if (historyData.history) {
          for (const h of historyData.history) {
            if (h.messagesAdded) {
              for (const m of h.messagesAdded) messageIds.add(m.message.id);
            }
            if (h.labelsAdded) {
              for (const m of h.labelsAdded) messageIds.add(m.message.id);
            }
            if (h.labelsRemoved) {
              for (const m of h.labelsRemoved) messageIds.add(m.message.id);
            }
          }
        }

        // Fetch each changed message
        let synced = 0;
        for (const msgId of messageIds) {
          const msg = await fetchGmailMessage(accessToken, msgId);
          if (!msg) continue;

          const headers = msg.payload?.headers || [];
          const fromRaw = getHeader(headers, "From");
          const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);
          const toRaw = getHeader(headers, "To");
          const ccRaw = getHeader(headers, "Cc");
          const { text: bodyText, html: bodyHtml } = decodeBody(msg.payload);

          const hasAttachments = msg.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0) || false;
          const attachments = msg.payload?.parts
            ?.filter((p: any) => p.filename && p.filename.length > 0)
            .map((p: any) => ({ filename: p.filename, mimeType: p.mimeType, size: p.body?.size || 0 })) || [];

          const emailData = {
            email_account_id: emailAccountId,
            workspace_id: account.workspace_id,
            provider_id: msg.id,
            thread_id: msg.threadId,
            from_name: fromName,
            from_email: fromEmail,
            to_emails: parseEmailList(toRaw),
            cc_emails: parseEmailList(ccRaw),
            subject: getHeader(headers, "Subject") || "(sem assunto)",
            body_text: bodyText,
            body_html: bodyHtml,
            snippet: msg.snippet || "",
            folder: getFolder(msg.labelIds || []),
            is_read: !(msg.labelIds || []).includes("UNREAD"),
            is_starred: (msg.labelIds || []).includes("STARRED"),
            has_attachments: hasAttachments,
            attachments,
            received_at: new Date(parseInt(msg.internalDate)).toISOString(),
          };

          await supabaseAdmin
            .from("emails")
            .upsert(emailData, { onConflict: "email_account_id,provider_id" });
          synced++;
        }

        // Update cursor
        if (historyData.historyId) {
          await supabaseAdmin
            .from("email_accounts")
            .update({ sync_cursor: historyData.historyId, last_synced_at: new Date().toISOString() })
            .eq("id", emailAccountId);
        }

        return new Response(JSON.stringify({ success: true, synced, mode: "incremental" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // If history fails (e.g. historyId too old), fall through to full sync
      console.warn("[sync-emails] History API failed, falling back to full sync");
    }

    // Full sync: fetch latest messages
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error("[sync-emails] List failed:", errText);
      return new Response(JSON.stringify({ error: "Gmail API error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    let synced = 0;
    let latestHistoryId = "";

    for (const { id: msgId } of messages) {
      const msg = await fetchGmailMessage(accessToken, msgId);
      if (!msg) continue;

      if (msg.historyId && (!latestHistoryId || BigInt(msg.historyId) > BigInt(latestHistoryId))) {
        latestHistoryId = msg.historyId;
      }

      const headers = msg.payload?.headers || [];
      const fromRaw = getHeader(headers, "From");
      const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);
      const toRaw = getHeader(headers, "To");
      const ccRaw = getHeader(headers, "Cc");
      const { text: bodyText, html: bodyHtml } = decodeBody(msg.payload);

      const hasAttachments = msg.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0) || false;
      const attachments = msg.payload?.parts
        ?.filter((p: any) => p.filename && p.filename.length > 0)
        .map((p: any) => ({ filename: p.filename, mimeType: p.mimeType, size: p.body?.size || 0 })) || [];

      const emailData = {
        email_account_id: emailAccountId,
        workspace_id: account.workspace_id,
        provider_id: msg.id,
        thread_id: msg.threadId,
        from_name: fromName,
        from_email: fromEmail,
        to_emails: parseEmailList(toRaw),
        cc_emails: parseEmailList(ccRaw),
        subject: getHeader(headers, "Subject") || "(sem assunto)",
        body_text: bodyText,
        body_html: bodyHtml,
        snippet: msg.snippet || "",
        folder: getFolder(msg.labelIds || []),
        is_read: !(msg.labelIds || []).includes("UNREAD"),
        is_starred: (msg.labelIds || []).includes("STARRED"),
        has_attachments: hasAttachments,
        attachments,
        received_at: new Date(parseInt(msg.internalDate)).toISOString(),
      };

      await supabaseAdmin
        .from("emails")
        .upsert(emailData, { onConflict: "email_account_id,provider_id" });
      synced++;
    }

    // Save cursor for incremental sync
    if (latestHistoryId) {
      await supabaseAdmin
        .from("email_accounts")
        .update({ sync_cursor: latestHistoryId, last_synced_at: new Date().toISOString() })
        .eq("id", emailAccountId);
    }

    console.log(`[sync-emails] ✅ Synced ${synced} emails for account ${emailAccountId}`);

    return new Response(JSON.stringify({ success: true, synced, mode: "full" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-emails] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
