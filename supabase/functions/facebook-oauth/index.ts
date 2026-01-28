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
const APP_URL = Deno.env.get("APP_URL") || "https://inboxia-prime-ai.lovable.app";

// Create Supabase client with service role for database operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// GET - OAuth callback handler
app.get("/", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  console.log("[Facebook OAuth] Callback received");
  console.log(`[Facebook OAuth] Code: ${code ? "present" : "missing"}`);

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
    const expiresIn = tokenData.expires_in; // seconds
    const tokenExpiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString() 
      : null;

    console.log("[Facebook OAuth] ✅ Access token obtained");

    // Step 2: Get long-lived token (optional but recommended)
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

    // Step 3: Save meta_account to database
    const { data: metaAccount, error: accountError } = await supabase
      .from("meta_accounts")
      .insert({
        user_access_token: finalUserToken,
        token_expires_at: finalExpiresAt,
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

    // Step 5: Save each page and check for Instagram accounts
    for (const page of pages) {
      let instagramAccountId = null;
      let instagramUsername = null;
      let platform: "facebook" | "instagram" | "both" = "facebook";

      // Check if page has Instagram Business Account
      if (page.instagram_business_account?.id) {
        instagramAccountId = page.instagram_business_account.id;
        
        // Get Instagram username
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

      // Save page to database
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
        });

      if (pageError) {
        console.error(`[Facebook OAuth] Failed to save page ${page.name}:`, pageError);
      } else {
        console.log(`[Facebook OAuth] ✅ Page saved: ${page.name}`);
      }
    }

    console.log("[Facebook OAuth] 🎉 OAuth flow completed successfully!");
    
    // Redirect back to app with success
    return c.redirect(`${APP_URL}/settings?meta_connected=true&pages=${pages.length}`);
    
  } catch (err) {
    console.error("[Facebook OAuth] Unexpected error:", err);
    return c.redirect(`${APP_URL}/settings?error=unexpected_error`);
  }
});

// POST - Generate OAuth URL for frontend
app.post("/url", async (c) => {
  console.log("[Facebook OAuth] Generating OAuth URL...");
  
  const scopes = [
    "pages_show_list",
    "pages_messaging",
    "pages_manage_metadata",
    "pages_read_engagement",
    "instagram_manage_messages",
    "instagram_manage_comments",
    "business_management",
  ];

  const oauthUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
  oauthUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  oauthUrl.searchParams.set("scope", scopes.join(","));
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("config_id", ""); // Optional: for business login

  console.log("[Facebook OAuth] OAuth URL generated");

  return c.json({ url: oauthUrl.toString() }, 200, corsHeaders);
});

// OPTIONS - CORS preflight
app.options("*", (c) => {
  return new Response(null, {
    headers: corsHeaders,
  });
});

Deno.serve(app.fetch);
