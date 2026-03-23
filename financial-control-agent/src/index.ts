import "dotenv/config";
import express from "express";
import { startScheduler } from "./scheduler/jobs.js";
import { whatsappWebhookHandler } from "./handlers/webhook.js";
import { notifyOwner } from "./integrations/whatsapp.js";
import { runAgent } from "./agent/agent.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: "5mb" }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "financial-control-agent",
    timestamp: new Date().toISOString(),
  });
});

// ─── WhatsApp Webhook ─────────────────────────────────────────────────────────
// Configure this URL in Evolution API: POST /whatsapp/webhook
app.post("/whatsapp/webhook", whatsappWebhookHandler);

// ─── Manual trigger (for testing) ────────────────────────────────────────────
app.post("/agent/run", async (req, res) => {
  const { message, phone } = req.body as { message?: string; phone?: string };
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const from = phone ?? process.env.OWNER_PHONE!;
  const response = await runAgent(message, from);
  res.json({ response });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🤖 Financial Control Agent`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Webhook: POST ${process.env.PUBLIC_URL ?? `http://localhost:${PORT}`}/whatsapp/webhook\n`);

  startScheduler();

  // Optional: send startup notification
  if (process.env.NOTIFY_ON_START === "true") {
    await notifyOwner("🤖 Agente financeiro iniciado e pronto para uso!").catch(() => {});
  }
});

export default app;
