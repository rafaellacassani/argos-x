import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const app = new Hono().basePath("/facebook-webhook");

// Token de verificação configurado
const VERIFY_TOKEN = "inboxia-verification";

// GET - Verificação do webhook (Meta challenge)
app.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  console.log("[Facebook Webhook] Verification request received");
  console.log(`[Facebook Webhook] Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);

  // Verifica se é uma requisição de subscribe com o token correto
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Facebook Webhook] ✅ Verification successful");
    // Retorna o challenge como texto puro (requisito da Meta)
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.log("[Facebook Webhook] ❌ Verification failed - invalid token or mode");
  return new Response("Forbidden", { status: 403 });
});

// POST - Recebimento de eventos em tempo real
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log("[Facebook Webhook] 📩 Event received:");
    console.log(JSON.stringify(body, null, 2));

    // Processa diferentes tipos de eventos
    const object = body.object;
    
    if (object === "page") {
      // Eventos de Página do Facebook (mensagens, comentários)
      const entries = body.entry || [];
      for (const entry of entries) {
        const pageId = entry.id;
        const time = entry.time;
        
        // Mensagens recebidas
        const messaging = entry.messaging || [];
        for (const event of messaging) {
          console.log(`[Facebook Webhook] 💬 Message event from page ${pageId}:`, JSON.stringify(event));
        }
        
        // Comentários e reactions
        const changes = entry.changes || [];
        for (const change of changes) {
          console.log(`[Facebook Webhook] 📝 Change event from page ${pageId}:`, JSON.stringify(change));
        }
      }
    } else if (object === "instagram") {
      // Eventos do Instagram (DMs, comentários, mentions)
      const entries = body.entry || [];
      for (const entry of entries) {
        const igUserId = entry.id;
        
        // Mensagens do Instagram
        const messaging = entry.messaging || [];
        for (const event of messaging) {
          console.log(`[Facebook Webhook] 📸 Instagram message from ${igUserId}:`, JSON.stringify(event));
        }
        
        // Comentários e mentions do Instagram
        const changes = entry.changes || [];
        for (const change of changes) {
          console.log(`[Facebook Webhook] 📸 Instagram change from ${igUserId}:`, JSON.stringify(change));
        }
      }
    }

    // Retorna 200 OK imediatamente (requisito da Meta - responder em < 5s)
    return c.json({ status: "received" }, 200);
  } catch (error) {
    console.error("[Facebook Webhook] ❌ Error processing event:", error);
    // Ainda retorna 200 para evitar que a Meta desative o webhook
    return c.json({ status: "error", message: "Internal error" }, 200);
  }
});

// OPTIONS - CORS preflight
app.options("*", (c) => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});

Deno.serve(app.fetch);
