const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // This endpoint has been disabled. Workspace creation now requires
  // a confirmed Stripe Checkout session via the signup-checkout flow.
  return new Response(
    JSON.stringify({
      error: "Cadastro direto desabilitado. Utilize /cadastro para criar sua conta com checkout obrigatório.",
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
