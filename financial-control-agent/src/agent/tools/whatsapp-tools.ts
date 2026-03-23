import type Anthropic from "@anthropic-ai/sdk";
import { sendText } from "../../integrations/whatsapp.js";

export const whatsappTools: Anthropic.Tool[] = [
  {
    name: "whatsapp_send_message",
    description:
      "Envia uma mensagem WhatsApp para um número. Use para avisar o dono sobre pagamentos, enviar cobranças para clientes, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        phone: {
          type: "string",
          description:
            "Número com DDI sem + nem espaços. Ex: 5511999999999. Use 'owner' para enviar ao dono do agente.",
        },
        message: {
          type: "string",
          description: "Texto da mensagem a enviar.",
        },
      },
      required: ["phone", "message"],
    },
  },
];

export async function handleWhatsAppTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  if (name === "whatsapp_send_message") {
    const phone =
      (input.phone as string) === "owner"
        ? process.env.OWNER_PHONE!
        : (input.phone as string);
    await sendText(phone, input.message as string);
    return `Mensagem enviada para ${phone}.`;
  }
  return `Ferramenta desconhecida: ${name}`;
}
