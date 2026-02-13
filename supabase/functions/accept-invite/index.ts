import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find pending invite by user_id or email
    let invite = null;

    // Try by user_id first
    const { data: byUserId } = await supabaseAdmin
      .from("workspace_members")
      .select("*")
      .eq("user_id", userId)
      .is("accepted_at", null)
      .limit(1)
      .maybeSingle();

    if (byUserId) {
      invite = byUserId;
    } else if (userEmail) {
      // Try by invited_email
      const { data: byEmail } = await supabaseAdmin
        .from("workspace_members")
        .select("*")
        .eq("invited_email", userEmail)
        .is("accepted_at", null)
        .limit(1)
        .maybeSingle();

      if (byEmail) {
        invite = byEmail;
      }
    }

    if (!invite) {
      return new Response(
        JSON.stringify({ error: "No pending invite found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Accept the invite: set user_id and accepted_at
    const { error: updateError } = await supabaseAdmin
      .from("workspace_members")
      .update({
        user_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Error accepting invite:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to accept invite" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        workspace_id: invite.workspace_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
