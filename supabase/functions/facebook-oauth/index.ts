import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const app = new Hono().basePath("/facebook-oauth");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get environment variables
const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID")!;
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Redirect URI - this must match what's configured in Facebook Developers
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/facebook-oauth`;

// App URL for redirecting back after OAuth
const APP_URL = Deno.env.get("APP_URL") || "https://argosx.com.br";

// Create Supabase client with service role for database operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CSRF state token helpers using HMAC-SHA256 — now includes workspace_id
async function generateState(workspaceId: string): Promise<string> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = `${timestamp}:${nonce}:${workspaceId}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(FACEBOOK_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hmac = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return btoa(`${payload}:${hmac}`);
}

async function validateState(state: string): Promise<{ valid: boolean; workspaceId: string | null }> {
  try {
    const decoded = atob(state);
    const parts = decoded.split(":");
    if (parts.length !== 4) return { valid: false, workspaceId: null };
    const [timestamp, nonce, workspaceId, hmac] = parts;
    // Reject tokens older than 10 minutes
    if (Date.now() - parseInt(timestamp) > 600_000) return { valid: false, workspaceId: null };
    const payload = `${timestamp}:${nonce}:${workspaceId}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(FACEBOOK_APP_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    return { valid: expected === hmac, workspaceId: expected === hmac ? workspaceId : null };
  } catch {
    return { valid: false, workspaceId: null };
  }
}

// GET - OAuth callback handler
app.get("/", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");
  const state = c.req.query("state");

  console.log("[Facebook OAuth] Callback received");
  console.log(`[Facebook OAuth] Code: ${code ? "present" : "missing"}`);

  // Validate CSRF state parameter and extract workspace_id
  if (!state) {
    console.error("[Facebook OAuth] Missing state parameter");
    return c.redirect(`${APP_URL}/settings?error=invalid_state`);
  }

  const { valid, workspaceId } = await validateState(state);
  if (!valid || !workspaceId) {
    console.error("[Facebook OAuth] Invalid state parameter or missing workspace_id");
    return c.redirect(`${APP_URL}/settings?error=invalid_state`);
  }

  console.log(`[Facebook OAuth] workspace_id from state: ${workspaceId}`);

  // Handle OAuth errors
  if (error) {
    console.error(`[Facebook OAuth] Error: ${error} - ${errorDescription}`);
    return c.redirect(`${APP_URL}/settings?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    console.error("[Facebook OAuth] No code provided");
    return c.redirect(`${APP_URL}/settings?error=no_code`);
  }

  try {
    // Step 1: Exchange code for access token
    console.log("[Facebook OAuth] Exchanging code for access token...");
    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
    tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("[Facebook OAuth] Token exchange failed:", tokenData.error);
      return c.redirect(`${APP_URL}/settings?error=${encodeURIComponent(tokenData.error.message)}`);
    }

    const userAccessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;
    const tokenExpiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString() 
      : null;

    console.log("[Facebook OAuth] ✅ Access token obtained");

    // Step 2: Get long-lived token
    console.log("[Facebook OAuth] Exchanging for long-lived token...");
    const longLivedUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
    longLivedUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    longLivedUrl.searchParams.set("fb_exchange_token", userAccessToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    const finalUserToken = longLivedData.access_token || userAccessToken;
    const finalExpiresAt = longLivedData.expires_in 
      ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
      : tokenExpiresAt;

    console.log("[Facebook OAuth] ✅ Long-lived token obtained");

    // Step 3: Save meta_account to database WITH workspace_id
    const { data: metaAccount, error: accountError } = await supabase
      .from("meta_accounts")
      .insert({
        user_access_token: finalUserToken,
        token_expires_at: finalExpiresAt,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (accountError) {
      console.error("[Facebook OAuth] Failed to save meta_account:", accountError);
      return c.redirect(`${APP_URL}/settings?error=database_error`);
    }

    console.log("[Facebook OAuth] ✅ Meta account saved:", metaAccount.id);

    // Step 4: Get user's pages
    console.log("[Facebook OAuth] Fetching user pages...");
    const pagesUrl = new URL("https://graph.facebook.com/v18.0/me/accounts");
    pagesUrl.searchParams.set("access_token", finalUserToken);
    pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account");

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error("[Facebook OAuth] Failed to fetch pages:", pagesData.error);
      return c.redirect(`${APP_URL}/settings?error=pages_fetch_error`);
    }

    const pages = pagesData.data || [];
    console.log(`[Facebook OAuth] Found ${pages.length} pages`);

    // Step 5: Save each page WITH workspace_id
    for (const page of pages) {
      let instagramAccountId = null;
      let instagramUsername = null;
      let platform: "facebook" | "instagram" | "both" = "facebook";

      if (page.instagram_business_account?.id) {
        instagramAccountId = page.instagram_business_account.id;
        
        const igUrl = new URL(`https://graph.facebook.com/v18.0/${instagramAccountId}`);
        igUrl.searchParams.set("fields", "username");
        igUrl.searchParams.set("access_token", page.access_token);
        
        const igResponse = await fetch(igUrl.toString());
        const igData = await igResponse.json();
        
        if (igData.username) {
          instagramUsername = igData.username;
          platform = "both";
          console.log(`[Facebook OAuth] 📸 Instagram found: @${instagramUsername}`);
        }
      }

      const { error: pageError } = await supabase
        .from("meta_pages")
        .insert({
          meta_account_id: metaAccount.id,
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
          instagram_account_id: instagramAccountId,
          instagram_username: instagramUsername,
          platform: platform,
          workspace_id: workspaceId,
        });

      if (pageError) {
        console.error(`[Facebook OAuth] Failed to save page ${page.name}:`, pageError);
      } else {
        console.log(`[Facebook OAuth] ✅ Page saved: ${page.name}`);

        // Subscribe page to webhook so Meta sends events to our endpoint
        try {
          const subscribeRes = await fetch(
            `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                subscribed_fields: "messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads,feed",
                access_token: page.access_token,
              }),
            }
          );
          const subscribeData = await subscribeRes.json();
          if (subscribeData.success) {
            console.log(`[Facebook OAuth] ✅ Page ${page.name} subscribed to webhook`);
          } else {
            console.error(`[Facebook OAuth] ❌ Subscription failed for ${page.name}:`, subscribeData);
          }

          if (instagramAccountId) {
            const igSubscribeRes = await fetch(
              `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`,
              {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  subscribed_fields: "messages,messaging_postbacks,comments,live_comments,feed",
                  access_token: page.access_token,
                }),
              }
            );
            const igSubscribeData = await igSubscribeRes.json();
            console.log(`[Facebook OAuth] Instagram subscription response:`, igSubscribeData);
          }
        } catch (subErr) {
          console.error(`[Facebook OAuth] Error subscribing to webhook:`, subErr);
        }
      }
    }

    // Step 6: Detect Instagram accounts via me/instagram_accounts (fallback)
    const savedIgIds = new Set<string>();
    // Collect IGs already saved via Page detection
    for (const page of pages) {
      if (page.instagram_business_account?.id) {
        savedIgIds.add(page.instagram_business_account.id);
      }
    }

    console.log("[Facebook OAuth] Step 6: Fetching Instagram accounts via me/instagram_accounts...");
    try {
      const igAccountsUrl = new URL("https://graph.facebook.com/v18.0/me/instagram_accounts");
      igAccountsUrl.searchParams.set("fields", "id,username,profile_picture_url");
      igAccountsUrl.searchParams.set("access_token", finalUserToken);

      const igAccountsRes = await fetch(igAccountsUrl.toString());
      const igAccountsData = await igAccountsRes.json();
      const igAccounts = igAccountsData.data || [];

      console.log(`[Facebook OAuth] Found ${igAccounts.length} Instagram account(s) via me/instagram_accounts`);

      for (const ig of igAccounts) {
        if (!ig.id || savedIgIds.has(ig.id)) {
          console.log(`[Facebook OAuth] Skipping IG ${ig.id} (already saved via Page)`);
          continue;
        }

        const igUsername = ig.username || ig.id;
        console.log(`[Facebook OAuth] 📸 New Instagram detected: @${igUsername} (${ig.id})`);

        // Find a page_access_token to use for this IG (pick the first available page)
        const fallbackPageToken = pages.length > 0 ? pages[0].access_token : finalUserToken;

        const { error: igPageError } = await supabase
          .from("meta_pages")
          .insert({
            meta_account_id: metaAccount.id,
            page_id: ig.id,
            page_name: `@${igUsername}`,
            page_access_token: fallbackPageToken,
            instagram_account_id: ig.id,
            instagram_username: igUsername,
            platform: "instagram",
            workspace_id: workspaceId,
          });

        if (igPageError) {
          console.error(`[Facebook OAuth] Failed to save IG @${igUsername}:`, igPageError);
        } else {
          console.log(`[Facebook OAuth] ✅ Instagram saved: @${igUsername}`);
          savedIgIds.add(ig.id);
        }
      }
    } catch (igErr) {
      console.error("[Facebook OAuth] Error fetching me/instagram_accounts:", igErr);
    }

    console.log("[Facebook OAuth] 🎉 OAuth flow completed successfully!");
    return c.redirect(`${APP_URL}/settings?meta_connected=true&pages=${pages.length}&ig=${savedIgIds.size}`);
    
  } catch (err) {
    console.error("[Facebook OAuth] Unexpected error:", err);
    return c.redirect(`${APP_URL}/settings?error=unexpected_error`);
  }
});

// POST - Generate OAuth URL for frontend
app.post("/url", async (c) => {
  console.log("[Facebook OAuth] Generating OAuth URL...");
  
  // Extract workspace_id from request body
  let workspaceId: string;
  try {
    const body = await c.req.json();
    workspaceId = body.workspaceId;
    if (!workspaceId) throw new Error("Missing workspaceId");
  } catch {
    return c.json({ error: "workspaceId is required" }, 400, corsHeaders);
  }

  const scopes = [
    "pages_show_list",
    "pages_messaging",
    "pages_manage_metadata",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_comments",
    "business_management",
  ];

  const state = await generateState(workspaceId);

  const oauthUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
  oauthUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  oauthUrl.searchParams.set("scope", scopes.join(","));
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("state", state);

  console.log("[Facebook OAuth] OAuth URL generated with workspace_id in state");

  return c.json({ url: oauthUrl.toString() }, 200, corsHeaders);
});

// OPTIONS - CORS preflight
app.options("*", (c) => {
  return new Response(null, {
    headers: corsHeaders,
  });
});

Deno.serve(app.fetch);
