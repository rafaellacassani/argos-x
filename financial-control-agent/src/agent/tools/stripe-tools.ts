import type Anthropic from "@anthropic-ai/sdk";
import {
  listUpcomingInvoices,
  sendInvoiceReminder,
  createPaymentLink,
  getCustomerName,
  listRecentPayments,
} from "../../integrations/stripe.js";

export const stripeTools: Anthropic.Tool[] = [
  {
    name: "stripe_list_upcoming_invoices",
    description:
      "Lista faturas abertas do Stripe com vencimento nos próximos N dias. Use para verificar quais clientes têm pagamentos pendentes.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_ahead: {
          type: "number",
          description: "Quantidade de dias à frente para verificar. Padrão: 7",
        },
      },
    },
  },
  {
    name: "stripe_send_invoice_reminder",
    description:
      "Envia e-mail de cobrança para o cliente via Stripe (requer confirmação prévia do usuário).",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice_id: { type: "string", description: "ID da fatura no Stripe (inv_...)" },
      },
      required: ["invoice_id"],
    },
  },
  {
    name: "stripe_create_payment_link",
    description: "Cria um link de pagamento no Stripe para enviar ao cliente.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_id: { type: "string", description: "ID do cliente no Stripe" },
        amount: { type: "number", description: "Valor em reais (ou moeda configurada)" },
        currency: { type: "string", description: "Moeda: brl, usd, eur. Padrão: brl" },
        description: { type: "string", description: "Descrição do pagamento" },
      },
      required: ["customer_id", "amount", "description"],
    },
  },
  {
    name: "stripe_list_recent_payments",
    description: "Lista pagamentos recebidos nos últimos N dias.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Quantidade de dias. Padrão: 30" },
      },
    },
  },
];

export async function handleStripeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "stripe_list_upcoming_invoices": {
      const invoices = await listUpcomingInvoices((input.days_ahead as number) ?? 7);
      if (invoices.length === 0) return "Nenhuma fatura com vencimento próximo encontrada.";

      const lines = await Promise.all(
        invoices.map(async (inv) => {
          const customerName = await getCustomerName(inv.customer);
          const due = inv.dueDate
            ? inv.dueDate.toLocaleDateString("pt-BR")
            : "sem vencimento";
          return `• ${customerName} — ${inv.currency} ${inv.amount.toFixed(2)} — vence ${due} — ID: ${inv.id}`;
        })
      );
      return `Faturas próximas:\n${lines.join("\n")}`;
    }

    case "stripe_send_invoice_reminder": {
      await sendInvoiceReminder(input.invoice_id as string);
      return `E-mail de cobrança enviado para a fatura ${input.invoice_id}.`;
    }

    case "stripe_create_payment_link": {
      const url = await createPaymentLink(
        input.customer_id as string,
        input.amount as number,
        (input.currency as string) ?? "brl",
        input.description as string
      );
      return `Link de pagamento criado: ${url}`;
    }

    case "stripe_list_recent_payments": {
      const payments = await listRecentPayments((input.days as number) ?? 30);
      if (payments.length === 0) return "Nenhum pagamento encontrado no período.";
      const lines = payments.map(
        (p) =>
          `• ${p.date.toLocaleDateString("pt-BR")} — ${p.currency} ${p.amount.toFixed(2)} — ${p.customerEmail ?? "sem e-mail"} — ${p.status}`
      );
      return `Pagamentos recentes:\n${lines.join("\n")}`;
    }

    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}
