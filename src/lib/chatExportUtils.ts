import { formatDateTimeBR } from "@/lib/exportUtils";

export interface ConversationExportMessage {
  timestamp: string;
  sender: string;
  content: string;
}

export interface ConversationExportGroup {
  key: string;
  sourceLabel: string;
  contactName: string;
  contactId: string;
  messages: ConversationExportMessage[];
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  audio: "Áudio",
  contacts: "Contato",
  contact: "Contato",
  document: "Documento",
  image: "Imagem",
  reaction: "Reação",
  sticker: "Figurinha",
  template: "Template",
  text: "Texto",
  video: "Vídeo",
};

export function normalizeConversationPhone(value: string | null | undefined): string {
  return (value || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .replace(/@lid$/i, "")
    .replace(/[^0-9]/g, "");
}

export function resolveConversationContent(content: string | null | undefined, messageType?: string | null): string {
  const trimmed = (content || "").trim();
  if (trimmed) return trimmed;

  const normalizedType = (messageType || "text").toLowerCase();
  if (normalizedType !== "text") {
    return `[${MESSAGE_TYPE_LABELS[normalizedType] || normalizedType}]`;
  }

  return "(mensagem vazia)";
}

export function buildConversationExportText(params: {
  workspaceName: string;
  startISO: string;
  endISO: string;
  sourceLabel: string;
  groups: ConversationExportGroup[];
  totalMessages: number;
}): string {
  const { workspaceName, startISO, endISO, sourceLabel, groups, totalMessages } = params;

  const header = [
    "═══════════════════════════════════════════════════════════════",
    `  EXPORTAÇÃO DE CONVERSAS — ${workspaceName}`,
    `  Período: ${formatDateTimeBR(startISO)} até ${formatDateTimeBR(endISO)}`,
    `  Origem: ${sourceLabel}`,
    `  Total de conversas: ${groups.length}`,
    `  Total de mensagens: ${totalMessages}`,
    `  Gerado em: ${formatDateTimeBR(new Date())}`,
    "═══════════════════════════════════════════════════════════════",
    "",
  ].join("\n");

  const sections: string[] = [];

  for (const group of groups) {
    sections.push("");
    sections.push("───────────────────────────────────────────────────────────────");
    sections.push(`CONTATO: ${group.contactName}`);
    sections.push(`Telefone/JID: ${group.contactId}`);
    sections.push(`Origem: ${group.sourceLabel}`);
    sections.push(`Mensagens: ${group.messages.length}`);
    sections.push("───────────────────────────────────────────────────────────────");

    let lastDay = "";

    for (const message of group.messages) {
      const ts = new Date(message.timestamp);
      const day = ts.toLocaleDateString("pt-BR");

      if (day !== lastDay) {
        sections.push("");
        sections.push(`📅 ${day}`);
        lastDay = day;
      }

      const time = ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      sections.push(`[${time}] ${message.sender}: ${message.content}`);
    }

    sections.push("");
  }

  return header + sections.join("\n");
}