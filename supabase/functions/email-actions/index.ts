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

async function modifyGmailLabels(accessToken: string, messageId: string, addLabels: string[], removeLabels: string[]) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addLabelIds: addLabels,
        removeLabelIds: removeLabels,
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error("[email-actions] Gmail modify error:", errText);
    return false;
  }
  await res.text(); // consume body
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const userId = await getUserIdFromAuth(authHeader);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { emailId, action } = body;
    // action: "mark_read" | "mark_unread" | "star" | "unstar" | "archive" | "trash" | "move_to_inbox"

    if (!emailId || !action) {
      return new Response(JSON.stringify({ error: "emailId and action required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get email + account
    const { data: email } = await supabaseAdmin
      .from("emails")
      .select("*, email_accounts!inner(id, workspace_id)")
      .eq("id", emailId)
      .single();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accessToken = await refreshAccessToken(email.email_account_id);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token refresh failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let localUpdate: Record<string, any> = {};
    let addLabels: string[] = [];
    let removeLabels: string[] = [];

    switch (action) {
      case "mark_read":
        removeLabels = ["UNREAD"];
        localUpdate = { is_read: true };
        break;
      case "mark_unread":
        addLabels = ["UNREAD"];
        localUpdate = { is_read: false };
        break;
      case "star":
        addLabels = ["STARRED"];
        localUpdate = { is_starred: true };
        break;
      case "unstar":
        removeLabels = ["STARRED"];
        localUpdate = { is_starred: false };
        break;
      case "archive":
        removeLabels = ["INBOX"];
        localUpdate = { folder: "archive" };
        break;
      case "trash":
        addLabels = ["TRASH"];
        removeLabels = ["INBOX"];
        localUpdate = { folder: "trash" };
        break;
      case "move_to_inbox":
        addLabels = ["INBOX"];
        removeLabels = ["TRASH"];
        localUpdate = { folder: "inbox" };
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Apply to Gmail
    const success = await modifyGmailLabels(accessToken, email.provider_id, addLabels, removeLabels);
    if (!success) {
      return new Response(JSON.stringify({ error: "Gmail API error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update local cache
    await supabaseAdmin.from("emails").update(localUpdate).eq("id", emailId);

    console.log(`[email-actions] ✅ ${action} on email ${emailId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[email-actions] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
