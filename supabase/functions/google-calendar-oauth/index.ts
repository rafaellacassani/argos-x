import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const app = new Hono().basePath("/google-calendar-oauth");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://inboxia-prime-ai.lovable.app";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-oauth/callback`;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Generate HMAC state with userId + workspaceId
async function generateState(userId: string, workspaceId: string): Promise<string> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = `${timestamp}:${nonce}:${userId}:${workspaceId}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(GOOGLE_CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hmac = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return btoa(`${payload}:${hmac}`);
}

async function validateState(state: string): Promise<{ valid: boolean; userId: string | null; workspaceId: string | null }> {
  try {
    const decoded = atob(state);
    const parts = decoded.split(":");
    if (parts.length !== 5) return { valid: false, userId: null, workspaceId: null };
    const [timestamp, nonce, userId, workspaceId, hmac] = parts;
    if (Date.now() - parseInt(timestamp) > 600_000) return { valid: false, userId: null, workspaceId: null };
    const payload = `${timestamp}:${nonce}:${userId}:${workspaceId}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(GOOGLE_CLIENT_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    const isValid = expected === hmac;
    return { valid: isValid, userId: isValid ? userId : null, workspaceId: isValid ? workspaceId : null };
  } catch {
    return { valid: false, userId: null, workspaceId: null };
  }
}

// Helper to get userId from JWT
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

// POST /url - Generate Google OAuth URL
app.post("/url", async (c) => {
  const authHeader = c.req.header("Authorization");
  const userId = await getUserIdFromAuth(authHeader);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401, corsHeaders);
  }

  let workspaceId: string;
  try {
    const body = await c.req.json();
    workspaceId = body.workspaceId;
    if (!workspaceId) throw new Error("Missing workspaceId");
  } catch {
    return c.json({ error: "workspaceId is required" }, 400, corsHeaders);
  }

  const state = await generateState(userId, workspaceId);

  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  oauthUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", scopes.join(" "));
  oauthUrl.searchParams.set("access_type", "offline");
  oauthUrl.searchParams.set("prompt", "consent");
  oauthUrl.searchParams.set("state", state);

  console.log("[Google Calendar OAuth] URL generated for user:", userId);
  return c.json({ url: oauthUrl.toString() }, 200, corsHeaders);
});

// GET /callback - OAuth callback
app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const state = c.req.query("state");

  console.log("[Google Calendar OAuth] Callback received");

  if (!state) {
    console.error("[Google Calendar OAuth] Missing state");
    return c.redirect(`${APP_URL}/settings?error=invalid_state`);
  }

  const { valid, userId, workspaceId } = await validateState(state);
  if (!valid || !userId || !workspaceId) {
    console.error("[Google Calendar OAuth] Invalid state");
    return c.redirect(`${APP_URL}/settings?error=invalid_state`);
  }

  if (error) {
    console.error("[Google Calendar OAuth] Error:", error);
    return c.redirect(`${APP_URL}/settings?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return c.redirect(`${APP_URL}/settings?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[Google Calendar OAuth] Token exchange failed:", tokenData.error);
      return c.redirect(`${APP_URL}/settings?error=token_exchange_failed`);
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get user email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const googleEmail = userInfo.email || null;

    console.log("[Google Calendar OAuth] ✅ Google email:", googleEmail);

    // UPSERT token
    const { error: dbError } = await supabaseAdmin
      .from("google_calendar_tokens")
      .upsert({
        user_id: userId,
        workspace_id: workspaceId,
        access_token,
        refresh_token,
        token_expiry: tokenExpiry,
        google_email: googleEmail,
        sync_enabled: true,
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("[Google Calendar OAuth] DB error:", dbError);
      return c.redirect(`${APP_URL}/settings?error=database_error`);
    }

    console.log("[Google Calendar OAuth] 🎉 Connected successfully!");
    return c.redirect(`${APP_URL}/settings?google_calendar=connected`);
  } catch (err) {
    console.error("[Google Calendar OAuth] Unexpected error:", err);
    return c.redirect(`${APP_URL}/settings?error=unexpected_error`);
  }
});

// POST /refresh - Refresh access token
app.post("/refresh", async (c) => {
  let userId: string;
  try {
    const body = await c.req.json();
    userId = body.userId;
    if (!userId) throw new Error();
  } catch {
    return c.json({ error: "userId is required" }, 400, corsHeaders);
  }

  try {
    const { data: tokenRow, error } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .single();

    if (error || !tokenRow) {
      return c.json({ error: "Token not found" }, 404, corsHeaders);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return c.json({ error: "Refresh failed" }, 500, corsHeaders);
    }

    const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from("google_calendar_tokens")
      .update({ access_token: tokenData.access_token, token_expiry: newExpiry })
      .eq("user_id", userId);

    return c.json({ access_token: tokenData.access_token }, 200, corsHeaders);
  } catch (err) {
    console.error("[Google Calendar OAuth] Refresh error:", err);
    return c.json({ error: "Internal error" }, 500, corsHeaders);
  }
});

// DELETE /disconnect
app.delete("/disconnect", async (c) => {
  const authHeader = c.req.header("Authorization");
  const userId = await getUserIdFromAuth(authHeader);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401, corsHeaders);
  }

  const { error } = await supabaseAdmin
    .from("google_calendar_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return c.json({ error: "Failed to disconnect" }, 500, corsHeaders);
  }

  return c.json({ success: true }, 200, corsHeaders);
});

// OPTIONS - CORS preflight
app.options("*", (c) => {
  return new Response(null, { headers: corsHeaders });
});

Deno.serve(app.fetch);
