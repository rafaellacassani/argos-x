import type { Request, Response } from "express";
import { runAgent } from "../agent/agent.js";
import {
  getPendingConfirmation,
  removePendingConfirmation,
} from "../db/storage.js";
import { handleStripeTool } from "../agent/tools/stripe-tools.js";
import { handleContaAzulTool } from "../agent/tools/contaazul-tools.js";
import { notifyOwner } from "../integrations/whatsapp.js";

// Extracts phone number from Evolution API webhook payload
function extractPhoneAndMessage(body: Record<string, unknown>): {
  phone: string;
  message: string;
} | null {
  try {
    // Evolution API webhook shape
    const data = body.data as Record<string, unknown> | undefined;
    if (!data) return null;

    const key = data.key as Record<string, unknown> | undefined;
    const message = data.message as Record<string, unknown> | undefined;

    const remoteJid = key?.remoteJid as string | undefined;
    if (!remoteJid) return null;

    // Extract phone from JID format: 5511999999999@s.whatsapp.net
    const phone = remoteJid.replace(/@.+/, "");

    // Try to get message text from various formats
    const text =
      (message?.conversation as string) ||
      (message?.extendedTextMessage as Record<string, unknown>)?.text as string ||
      "";

    if (!text) return null;
    return { phone, message: text };
  } catch {
    return null;
  }
}

// Handle confirmation responses: "SIM ABCD1234" or "NÃO ABCD1234"
async function handleConfirmationResponse(
  text: string,
  phone: string
): Promise<boolean> {
  const upper = text.trim().toUpperCase();
  const confirmMatch = upper.match(/^(SIM|YES|S)\s+([A-Z0-9]{8})$/);
  const denyMatch = upper.match(/^(NÃO|NAO|NO|N)\s+([A-Z0-9]{8})$/);

  if (!confirmMatch && !denyMatch) return false;

  const id = (confirmMatch ?? denyMatch)![2];
  const confirmed = !!confirmMatch;

  const pending = getPendingConfirmation(id);
  if (!pending) {
    await notifyOwner(
      `❌ Confirmação *${id}* não encontrada ou expirada.`
    );
    return true;
  }

  removePendingConfirmation(id);

  if (!confirmed) {
    await notifyOwner(`🚫 Ação *${id}* cancelada.`);
    return true;
  }

  // Execute the confirmed action
  try {
    let result = "Ação executada.";
    const { action, payload } = pending;

    if (action.startsWith("stripe_")) {
      result = await handleStripeTool(action, payload as Record<string, unknown>);
    } else if (action.startsWith("contaazul_")) {
      result = await handleContaAzulTool(action, payload as Record<string, unknown>);
    } else {
      result = `Ação "${action}" executada com os parâmetros fornecidos.`;
    }

    await notifyOwner(`✅ *${id}* concluído:\n${result}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notifyOwner(`⚠️ Erro ao executar *${id}*: ${msg}`);
  }

  return true;
}

export async function whatsappWebhookHandler(
  req: Request,
  res: Response
): Promise<void> {
  // Respond immediately so Evolution API doesn't retry
  res.status(200).json({ ok: true });

  const body = req.body as Record<string, unknown>;

  // Ignore status updates and sent messages
  const event = body.event as string | undefined;
  if (!event || event !== "messages.upsert") return;

  const parsed = extractPhoneAndMessage(body);
  if (!parsed) return;

  const { phone, message } = parsed;

  // Only respond to the owner for security
  const ownerPhone = process.env.OWNER_PHONE!;
  if (phone !== ownerPhone) {
    console.log(`[Webhook] Mensagem ignorada de ${phone} (não é o dono)`);
    return;
  }

  console.log(`[Webhook] Mensagem recebida de ${phone}: ${message.slice(0, 80)}`);

  // Check if this is a confirmation response first
  const wasConfirmation = await handleConfirmationResponse(message, phone);
  if (wasConfirmation) return;

  // Otherwise, pass to the agent
  try {
    const response = await runAgent(message, phone);
    if (response) {
      const { sendText } = await import("../integrations/whatsapp.js");
      await sendText(phone, response);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Webhook] Erro ao processar mensagem:", msg);
    await notifyOwner(`⚠️ Erro ao processar sua mensagem: ${msg}`).catch(() => {});
  }
}
