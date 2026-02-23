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

  if (tokenData.error) return null;

  const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("email_accounts")
    .update({ access_token: tokenData.access_token, token_expiry: newExpiry })
    .eq("id", accountId);

  return tokenData.access_token;
}

function createRawEmail(
  from: string,
  to: string,
  subject: string,
  body: string,
  options?: { inReplyTo?: string; references?: string; cc?: string; threadId?: string }
): string {
  const boundary = `boundary_${crypto.randomUUID()}`;
  
  let headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (options?.cc) headers.push(`Cc: ${options.cc}`);
  if (options?.inReplyTo) headers.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options?.references) headers.push(`References: ${options.references}`);

  const plainText = body.replace(/<[^>]*>/g, "");

  const raw = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainText,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    body,
    `--${boundary}--`,
  ].join("\r\n");

  // Base64url encode
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
    const { emailAccountId, to, cc, subject, bodyHtml, replyToEmailId } = body;

    if (!emailAccountId || !to || !subject || !bodyHtml) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: account } = await supabaseAdmin
      .from("email_accounts")
      .select("*")
      .eq("id", emailAccountId)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accessToken = await refreshAccessToken(emailAccountId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Failed to get access token" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If replying, get the original email for threading
    let replyOptions: any = {};
    let threadId: string | undefined;
    
    if (replyToEmailId) {
      const { data: originalEmail } = await supabaseAdmin
        .from("emails")
        .select("provider_id, thread_id, subject")
        .eq("id", replyToEmailId)
        .single();

      if (originalEmail) {
        replyOptions = {
          inReplyTo: `<${originalEmail.provider_id}@mail.gmail.com>`,
          references: `<${originalEmail.provider_id}@mail.gmail.com>`,
        };
        threadId = originalEmail.thread_id || undefined;
      }
    }

    const rawMessage = createRawEmail(
      account.email_address,
      to,
      subject,
      bodyHtml,
      { ...replyOptions, cc }
    );

    // Send via Gmail API
    const sendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const sendBody: any = { raw: rawMessage };
    if (threadId) sendBody.threadId = threadId;

    const sendRes = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("[send-email] Gmail API error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sentData = await sendRes.json();

    // Save to local cache
    await supabaseAdmin.from("emails").upsert({
      email_account_id: emailAccountId,
      workspace_id: account.workspace_id,
      provider_id: sentData.id,
      thread_id: sentData.threadId || threadId || sentData.id,
      from_name: account.email_address,
      from_email: account.email_address,
      to_emails: to.split(",").map((e: string) => e.trim()),
      cc_emails: cc ? cc.split(",").map((e: string) => e.trim()) : [],
      subject,
      body_text: bodyHtml.replace(/<[^>]*>/g, ""),
      body_html: bodyHtml,
      snippet: bodyHtml.replace(/<[^>]*>/g, "").substring(0, 200),
      folder: "sent",
      is_read: true,
      is_starred: false,
      has_attachments: false,
      attachments: [],
      received_at: new Date().toISOString(),
    }, { onConflict: "email_account_id,provider_id" });

    console.log("[send-email] ✅ Email sent:", sentData.id);

    return new Response(JSON.stringify({ success: true, messageId: sentData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-email] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
