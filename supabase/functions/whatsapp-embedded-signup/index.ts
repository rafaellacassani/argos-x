import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID")!;
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { code, phone_number_id, waba_id, workspace_id } = await req.json();

    if (!code || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "code and workspace_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Embedded Signup] Processing signup for workspace:", workspace_id);
    console.log("[Embedded Signup] phone_number_id:", phone_number_id, "waba_id:", waba_id);

    // Step 1: Exchange code for access token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
    tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[Embedded Signup] Token exchange failed:", tokenData.error);
      return new Response(
        JSON.stringify({ error: "Token exchange failed", details: tokenData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;
    console.log("[Embedded Signup] ✅ Access token obtained");

    // Step 2: If we don't have phone_number_id/waba_id from the frontend event,
    // try to discover them from the user's businesses
    let finalPhoneNumberId = phone_number_id;
    let finalWabaId = waba_id;
    let phoneDisplay = "";
    let verifiedName = "";

    if (finalWabaId && finalPhoneNumberId) {
      // We have IDs from the Embedded Signup event — fetch details
      try {
        const phoneRes = await fetch(
          `https://graph.facebook.com/v21.0/${finalPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const phoneData = await phoneRes.json();
        phoneDisplay = phoneData.display_phone_number || finalPhoneNumberId;
        verifiedName = phoneData.verified_name || "WhatsApp Business";
        console.log(`[Embedded Signup] ✅ Phone: ${phoneDisplay} (${verifiedName})`);
      } catch (err) {
        console.error("[Embedded Signup] Error fetching phone details:", err);
        phoneDisplay = finalPhoneNumberId;
        verifiedName = "WhatsApp Business";
      }
    } else {
      // Discover WABAs from user's businesses
      console.log("[Embedded Signup] No IDs from event, discovering WABAs...");
      try {
        const bizRes = await fetch(
          `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&access_token=${accessToken}`
        );
        const bizData = await bizRes.json();
        const businesses = bizData.data || [];

        for (const biz of businesses) {
          const wabaRes = await fetch(
            `https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}&access_token=${accessToken}`
          );
          const wabaData = await wabaRes.json();
          const wabas = wabaData.data || [];

          if (wabas.length > 0) {
            const waba = wabas[0];
            finalWabaId = waba.id;
            const phones = waba.phone_numbers?.data || [];
            if (phones.length > 0) {
              finalPhoneNumberId = phones[0].id;
              phoneDisplay = phones[0].display_phone_number || phones[0].id;
              verifiedName = phones[0].verified_name || waba.name || "WhatsApp Business";
            }
            break;
          }
        }
      } catch (err) {
        console.error("[Embedded Signup] Error discovering WABAs:", err);
      }

      if (!finalWabaId || !finalPhoneNumberId) {
        return new Response(
          JSON.stringify({ error: "No WABA or phone number found in your Meta account" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 3: Subscribe WABA to our app's webhook
    try {
      const subRes = await fetch(
        `https://graph.facebook.com/v21.0/${finalWabaId}/subscribed_apps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ access_token: accessToken }),
        }
      );
      const subData = await subRes.json();
      if (subData.success) {
        console.log(`[Embedded Signup] ✅ WABA ${finalWabaId} subscribed to webhook`);
      } else {
        console.error(`[Embedded Signup] ❌ WABA subscription failed:`, subData);
      }
    } catch (err) {
      console.error("[Embedded Signup] Error subscribing WABA:", err);
    }

    // Step 4: Save meta_account
    let metaAccountId: string;
    const { data: existingAccounts } = await supabase
      .from("meta_accounts")
      .select("id")
      .eq("workspace_id", workspace_id)
      .limit(1);

    if (existingAccounts && existingAccounts.length > 0) {
      metaAccountId = existingAccounts[0].id;
      // Update the token
      await supabase
        .from("meta_accounts")
        .update({ user_access_token: accessToken, updated_at: new Date().toISOString() })
        .eq("id", metaAccountId);
    } else {
      const { data: newAccount, error: accErr } = await supabase
        .from("meta_accounts")
        .insert({
          workspace_id: workspace_id,
          user_access_token: accessToken,
        })
        .select("id")
        .single();
      if (accErr || !newAccount) {
        console.error("[Embedded Signup] Failed to save meta_account:", accErr);
        return new Response(
          JSON.stringify({ error: "Failed to save account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      metaAccountId = newAccount.id;
    }

    // Step 5: Create meta_page (for webhook routing)
    const { data: metaPage, error: pageErr } = await supabase
      .from("meta_pages")
      .upsert(
        {
          meta_account_id: metaAccountId,
          page_id: finalPhoneNumberId,
          page_name: `WhatsApp - ${phoneDisplay}`,
          page_access_token: accessToken,
          platform: "whatsapp_business",
          workspace_id: workspace_id,
          is_active: true,
        },
        { onConflict: "page_id" }
      )
      .select("id")
      .single();

    if (pageErr) {
      console.error("[Embedded Signup] Failed to save meta_page:", pageErr);
    }

    // Step 6: Create whatsapp_cloud_connection
    const { data: connection, error: connErr } = await supabase
      .from("whatsapp_cloud_connections")
      .upsert(
        {
          workspace_id: workspace_id,
          waba_id: finalWabaId,
          phone_number_id: finalPhoneNumberId,
          phone_number: phoneDisplay,
          inbox_name: verifiedName,
          access_token: accessToken,
          status: "active",
          is_active: true,
          meta_page_id: metaPage?.id || null,
        },
        { onConflict: "workspace_id,phone_number_id" }
      )
      .select("id, phone_number, inbox_name")
      .single();

    if (connErr) {
      console.error("[Embedded Signup] Failed to save connection:", connErr);
      // Fallback: try insert
      const { error: insertErr } = await supabase
        .from("whatsapp_cloud_connections")
        .insert({
          workspace_id: workspace_id,
          waba_id: finalWabaId,
          phone_number_id: finalPhoneNumberId,
          phone_number: phoneDisplay,
          inbox_name: verifiedName,
          access_token: accessToken,
          status: "active",
          is_active: true,
          meta_page_id: metaPage?.id || null,
        });
      if (insertErr) {
        console.error("[Embedded Signup] Insert fallback failed:", insertErr);
      }
    }

    console.log("[Embedded Signup] 🎉 Embedded Signup completed successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        phone_number: phoneDisplay,
        inbox_name: verifiedName,
        waba_id: finalWabaId,
        phone_number_id: finalPhoneNumberId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Embedded Signup] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
