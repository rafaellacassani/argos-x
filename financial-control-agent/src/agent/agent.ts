import Anthropic from "@anthropic-ai/sdk";
import { stripeTools, handleStripeTool } from "./tools/stripe-tools.js";
import { sheetsTools, handleSheetsTool } from "./tools/sheets-tools.js";
import { whatsappTools, handleWhatsAppTool } from "./tools/whatsapp-tools.js";
import { contaAzulTools, handleContaAzulTool } from "./tools/contaazul-tools.js";
import {
  confirmationTools,
  handleConfirmationTool,
} from "./tools/confirmation-tools.js";
import { addMessage, getHistory } from "../db/storage.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Você é um agente financeiro pessoal e empresarial do(a) ${process.env.OWNER_PHONE ?? "seu dono"}.

Você tem acesso a:
- Stripe: faturas e pagamentos de clientes
- Google Sheets: planilhas financeiras pessoais e de clientes
- WhatsApp: envio de mensagens e cobranças
- Conta Azul: vendas, clientes e emissão de notas fiscais
- Sistema de confirmação: para ações sensíveis que precisam de autorização

Regras importantes:
1. SEMPRE solicite confirmação via "request_confirmation" antes de: enviar cobranças, emitir notas fiscais, criar links de pagamento, ou qualquer ação que afete clientes.
2. Para consultas (listar, verificar, resumir), pode executar diretamente sem confirmação.
3. Responda sempre em português brasileiro, de forma clara e objetiva.
4. Ao listar pagamentos/faturas, organize de forma legível e destaque valores e datas.
5. Quando o dono disser "SIM [ID]" ou "NÃO [ID]", identifique a confirmação e proceda.
6. Seja proativo: se detectar algo urgente (vencimento hoje), avise imediatamente.

Formato de datas: DD/MM/AAAA
Formato de valores: R$ X.XXX,XX`;

const ALL_TOOLS = [
  ...stripeTools,
  ...sheetsTools,
  ...whatsappTools,
  ...contaAzulTools,
  ...confirmationTools,
];

type MessageParam = Anthropic.MessageParam;

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  phone: string
): Promise<string> {
  try {
    if (name.startsWith("stripe_")) return await handleStripeTool(name, input);
    if (name.startsWith("sheets_")) return await handleSheetsTool(name, input);
    if (name.startsWith("whatsapp_")) return await handleWhatsAppTool(name, input);
    if (name.startsWith("contaazul_")) return await handleContaAzulTool(name, input);
    if (name === "request_confirmation")
      return await handleConfirmationTool(name, input, phone);
    return `Ferramenta não reconhecida: ${name}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Erro ao executar ${name}: ${message}`;
  }
}

export async function runAgent(
  userMessage: string,
  phone: string
): Promise<string> {
  addMessage(phone, "user", userMessage);

  const history = getHistory(phone);
  const messages: MessageParam[] = history.map(({ role, content }) => ({
    role,
    content,
  }));

  // Add current user message if not already in history (it was just added)
  if (
    messages.length === 0 ||
    messages[messages.length - 1].role !== "user" ||
    messages[messages.length - 1].content !== userMessage
  ) {
    messages[messages.length - 1] = { role: "user", content: userMessage };
  }

  let finalResponse = "";

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: ALL_TOOLS,
      messages,
    });

    // Collect text from this response
    const textBlocks = response.content.filter((b) => b.type === "text");
    if (textBlocks.length > 0) {
      finalResponse = textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n");
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      // Add assistant response to messages
      messages.push({ role: "assistant", content: response.content });

      // Execute all tools and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const toolUse = block as Anthropic.ToolUseBlock;
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            phone
          );
          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: result,
          };
        })
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  if (finalResponse) {
    addMessage(phone, "assistant", finalResponse);
  }

  return finalResponse || "Processado.";
}

/**
 * Run a task directly (no conversation history — for cron jobs)
 */
export async function runTask(taskPrompt: string): Promise<string> {
  const messages: MessageParam[] = [{ role: "user", content: taskPrompt }];
  let finalResponse = "";

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: ALL_TOOLS,
      messages,
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    if (textBlocks.length > 0) {
      finalResponse = textBlocks.map((b) => (b as Anthropic.TextBlock).text).join("\n");
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const toolUse = block as Anthropic.ToolUseBlock;
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            process.env.OWNER_PHONE!
          );
          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: result,
          };
        })
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return finalResponse || "Tarefa concluída.";
}
