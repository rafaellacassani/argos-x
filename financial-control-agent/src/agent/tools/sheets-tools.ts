import type Anthropic from "@anthropic-ai/sdk";
import {
  readSheet,
  appendRow,
  updateCell,
  listSheets,
  getUpcomingPersonalPayments,
  resolveSheetId,
} from "../../integrations/google-sheets.js";

export const sheetsTools: Anthropic.Tool[] = [
  {
    name: "sheets_list_upcoming_personal_payments",
    description:
      "Lê a planilha financeira pessoal e retorna contas/pagamentos com vencimento próximo que ainda não foram pagos.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_ahead: {
          type: "number",
          description: "Dias à frente para verificar. Padrão: 7",
        },
      },
    },
  },
  {
    name: "sheets_read_range",
    description:
      "Lê um intervalo específico de uma planilha Google Sheets. Útil para consultar dados financeiros.",
    input_schema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: {
          type: "string",
          description:
            "ID da planilha. Use 'familia' para a seção familiar/pessoal, 'empresa' para a seção empresarial, ou um ID completo do Google Sheets.",
        },
        range: {
          type: "string",
          description: "Intervalo no formato Aba!A1:Z100, ex: Pagamentos!A:F",
        },
      },
      required: ["spreadsheet_id", "range"],
    },
  },
  {
    name: "sheets_append_row",
    description: "Adiciona uma linha na planilha (ex: registrar um pagamento recebido).",
    input_schema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string" },
        range: { type: "string", description: "Aba onde adicionar, ex: Pagamentos!A:Z" },
        values: {
          type: "array",
          items: { type: "string" },
          description: "Valores da linha na ordem das colunas",
        },
      },
      required: ["spreadsheet_id", "range", "values"],
    },
  },
  {
    name: "sheets_update_cell",
    description: "Atualiza uma célula específica na planilha (ex: marcar pagamento como Pago).",
    input_schema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string" },
        range: { type: "string", description: "Célula exata, ex: Família!E5" },
        value: { type: "string", description: "Novo valor, ex: Pago" },
      },
      required: ["spreadsheet_id", "range", "value"],
    },
  },
  {
    name: "sheets_list_sheets",
    description: "Lista as abas disponíveis em uma planilha.",
    input_schema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string" },
      },
      required: ["spreadsheet_id"],
    },
  },
];

function resolveSpreadsheetId(id: string): string {
  return resolveSheetId(id);
}

export async function handleSheetsTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "sheets_list_upcoming_personal_payments": {
      const rows = await getUpcomingPersonalPayments((input.days_ahead as number) ?? 7);
      if (rows.length === 0) return "Nenhuma conta pessoal com vencimento próximo.";
      const lines = rows.map((r) => {
        const desc = r["Descrição"] || r["descricao"] || r["Nome"] || "—";
        const val = r["Valor"] || r["valor"] || "—";
        const venc = r["Vencimento"] || r["vencimento"] || "—";
        return `• ${desc} — R$ ${val} — vence ${venc}`;
      });
      return `Contas pessoais a pagar:\n${lines.join("\n")}`;
    }

    case "sheets_read_range": {
      const id = resolveSpreadsheetId(input.spreadsheet_id as string);
      const rows = await readSheet(id, input.range as string);
      if (rows.length === 0) return "Nenhum dado encontrado no intervalo informado.";
      return JSON.stringify(rows, null, 2);
    }

    case "sheets_append_row": {
      const id = resolveSpreadsheetId(input.spreadsheet_id as string);
      await appendRow(id, input.range as string, input.values as string[]);
      return "Linha adicionada com sucesso.";
    }

    case "sheets_update_cell": {
      const id = resolveSpreadsheetId(input.spreadsheet_id as string);
      await updateCell(id, input.range as string, input.value as string);
      return `Célula ${input.range} atualizada para "${input.value}".`;
    }

    case "sheets_list_sheets": {
      const id = resolveSpreadsheetId(input.spreadsheet_id as string);
      const tabs = await listSheets(id);
      return `Abas disponíveis: ${tabs.join(", ")}`;
    }

    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}
