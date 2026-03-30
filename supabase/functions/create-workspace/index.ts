const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // This endpoint has been disabled. Workspace creation now requires
  // a confirmed Stripe Checkout session via the signup-checkout flow.
  return new Response(
    JSON.stringify({
      error: "Criação direta de workspace desabilitada. Utilize o fluxo de cadastro com checkout em /cadastro.",
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
