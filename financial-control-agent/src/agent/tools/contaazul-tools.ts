import type Anthropic from "@anthropic-ai/sdk";
import {
  listOpenSales,
  listCustomers,
  emitServiceInvoice,
  getUpcomingSales,
} from "../../integrations/conta-azul.js";

export const contaAzulTools: Anthropic.Tool[] = [
  {
    name: "contaazul_list_upcoming_sales",
    description:
      "Lista vendas/cobranças abertas no Conta Azul com vencimento nos próximos N dias.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_ahead: { type: "number", description: "Dias à frente. Padrão: 7" },
      },
    },
  },
  {
    name: "contaazul_list_customers",
    description: "Lista os clientes cadastrados no Conta Azul.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "contaazul_emit_nfse",
    description:
      "Emite nota fiscal de serviço (NFS-e) para uma venda no Conta Azul (requer confirmação prévia do usuário).",
    input_schema: {
      type: "object" as const,
      properties: {
        sale_id: { type: "string", description: "ID da venda no Conta Azul" },
      },
      required: ["sale_id"],
    },
  },
  {
    name: "contaazul_list_open_sales",
    description: "Lista todas as vendas com pagamento pendente no Conta Azul.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

export async function handleContaAzulTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "contaazul_list_upcoming_sales": {
      const sales = await getUpcomingSales((input.days_ahead as number) ?? 7);
      if (sales.length === 0) return "Nenhuma venda com vencimento próximo no Conta Azul.";
      const lines = sales.map(
        (s) =>
          `• ${s.customer_name} — R$ ${s.total.toFixed(2)} — vence ${new Date(s.due_date).toLocaleDateString("pt-BR")} — ID: ${s.id}`
      );
      return `Vendas próximas (Conta Azul):\n${lines.join("\n")}`;
    }

    case "contaazul_list_customers": {
      const customers = await listCustomers();
      if (customers.length === 0) return "Nenhum cliente encontrado.";
      const lines = customers.map((c) => `• ${c.name} — ${c.email} — ${c.document}`);
      return `Clientes (Conta Azul):\n${lines.join("\n")}`;
    }

    case "contaazul_emit_nfse": {
      const result = await emitServiceInvoice(input.sale_id as string);
      const url = result.nfseUrl ? `\nLink NFS-e: ${result.nfseUrl}` : "";
      return `Nota fiscal emitida para a venda ${input.sale_id}.${url}`;
    }

    case "contaazul_list_open_sales": {
      const sales = await listOpenSales();
      if (sales.length === 0) return "Nenhuma venda em aberto no Conta Azul.";
      const lines = sales.map(
        (s) =>
          `• ${s.customer_name} — R$ ${s.total.toFixed(2)} — vence ${new Date(s.due_date).toLocaleDateString("pt-BR")}`
      );
      return `Vendas em aberto (Conta Azul):\n${lines.join("\n")}`;
    }

    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}
