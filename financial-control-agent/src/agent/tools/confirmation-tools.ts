import type Anthropic from "@anthropic-ai/sdk";
import { savePendingConfirmation, getPendingForPhone } from "../../db/storage.js";
import { notifyOwner } from "../../integrations/whatsapp.js";
import { randomUUID } from "crypto";

export const confirmationTools: Anthropic.Tool[] = [
  {
    name: "request_confirmation",
    description:
      "Solicita confirmação do usuário (dono) via WhatsApp antes de executar uma ação sensível como cobrar, emitir NF, criar pagamento, etc. Retorna um ID de confirmação. Aguarde a resposta do usuário.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          description:
            "Nome da ação a ser confirmada, ex: 'stripe_send_invoice_reminder'",
        },
        description: {
          type: "string",
          description:
            "Descrição em linguagem natural do que será feito, ex: 'Enviar cobrança por e-mail para João Silva (R$ 500,00)'",
        },
        payload: {
          type: "object",
          description: "Parâmetros da ação que será executada após confirmação",
        },
      },
      required: ["action", "description", "payload"],
    },
  },
];

export async function handleConfirmationTool(
  name: string,
  input: Record<string, unknown>,
  phone: string
): Promise<string> {
  if (name === "request_confirmation") {
    const id = randomUUID().slice(0, 8).toUpperCase();
    const ownerPhone = process.env.OWNER_PHONE!;

    savePendingConfirmation(
      id,
      ownerPhone,
      input.action as string,
      input.payload as Record<string, unknown>
    );

    const msg =
      `⚡ *Confirmação necessária* [${id}]\n\n` +
      `${input.description}\n\n` +
      `Responda:\n• *SIM ${id}* — confirmar\n• *NÃO ${id}* — cancelar`;

    await notifyOwner(msg);

    return `Solicitação de confirmação enviada ao dono (ID: ${id}). Aguardando resposta via WhatsApp.`;
  }
  return `Ferramenta desconhecida: ${name}`;
}
