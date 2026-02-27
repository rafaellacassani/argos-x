import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { to, fullName, checkoutUrl, plan } = await req.json();

    if (!to || !fullName || !checkoutUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, fullName, checkoutUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planLabel = {
      essencial: "Essencial",
      negocio: "Negócio",
      escala: "Escala",
    }[plan] || plan || "Selecionado";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0171C3;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Argos X</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Olá, ${fullName}! 👋</h2>
          <p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.6;">
            Você foi convidado(a) para começar a usar o <strong>Argos X</strong> com o plano <strong>${planLabel}</strong>.
          </p>
          <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
            Clique no botão abaixo para finalizar sua assinatura e começar a usar a plataforma:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${checkoutUrl}" target="_blank" style="display:inline-block;background:#0171C3;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                Finalizar Assinatura
              </a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">
            Se o botão não funcionar, copie e cole este link no navegador:<br/>
            <a href="${checkoutUrl}" style="color:#0171C3;word-break:break-all;">${checkoutUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;background:#fafafa;text-align:center;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">
            © ${new Date().getFullYear()} Argos X · Todos os direitos reservados
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Argos X <noreply@argosx.com.br>",
        to: [to],
        subject: `${fullName}, sua assinatura do Argos X está pronta!`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(
        JSON.stringify({ error: result?.message || "Failed to send email" }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-onboarding-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
