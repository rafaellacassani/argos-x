import cron from "node-cron";
import { runTask } from "../agent/agent.js";
import { notifyOwner } from "../integrations/whatsapp.js";
import { wasReminderSent, markReminderSent, pruneOldReminders } from "../db/storage.js";

const DAILY_CHECK = process.env.CRON_DAILY_CHECK ?? "0 8 * * *";
const WEEKLY_SUMMARY = process.env.CRON_WEEKLY_SUMMARY ?? "0 9 * * 1";

async function dailyFinancialCheck() {
  console.log("[Scheduler] Iniciando verificação financeira diária...");
  pruneOldReminders();

  const today = new Date().toLocaleDateString("pt-BR");

  try {
    const result = await runTask(
      `Faça uma verificação financeira completa para hoje (${today}):

1. Verifique faturas abertas no Stripe com vencimento nos próximos 3 dias.
2. Verifique contas pessoais na planilha pessoal (sheets_list_upcoming_personal_payments, days_ahead: 3).
3. Verifique vendas com vencimento próximo no Conta Azul (contaazul_list_upcoming_sales, days_ahead: 3).

Para cada item encontrado que ainda não foi notificado hoje:
- Se vence HOJE: envie mensagem urgente para o dono via WhatsApp com o resumo.
- Se vence em 1-3 dias: consolide em um único resumo e envie ao dono.

Use wasReminderSent para verificar se já notificou. Use a chave no formato "check:TIPO:ID:DATA" para cada item.

Se não houver nada urgente, envie apenas uma mensagem curta: "✅ Verificação diária: nenhum vencimento crítico nos próximos 3 dias."

Ao enviar cobranças ou notas fiscais, SEMPRE solicite confirmação primeiro.`
    );
    console.log("[Scheduler] Verificação diária concluída:", result.slice(0, 100));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Scheduler] Erro na verificação diária:", msg);
    await notifyOwner(`⚠️ Erro na verificação financeira diária: ${msg}`).catch(() => {});
  }
}

async function weeklyFinancialSummary() {
  console.log("[Scheduler] Gerando resumo semanal...");

  try {
    const result = await runTask(
      `Gere um resumo financeiro completo da semana:

1. Liste todos os pagamentos recebidos nos últimos 7 dias (Stripe).
2. Liste todas as vendas pendentes no Conta Azul.
3. Liste as contas pessoais a vencer nos próximos 7 dias (Google Sheets).
4. Liste as faturas Stripe com vencimento nos próximos 7 dias.

Monte um resumo organizado com:
- 📥 Recebimentos da semana (total + lista)
- 📤 A receber esta semana (clientes)
- 💸 Contas pessoais a pagar
- ⚠️ Alertas (vencimentos hoje ou atrasados)

Envie o resumo ao dono via WhatsApp (phone: owner).`
    );
    console.log("[Scheduler] Resumo semanal enviado:", result.slice(0, 100));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Scheduler] Erro no resumo semanal:", msg);
    await notifyOwner(`⚠️ Erro no resumo semanal: ${msg}`).catch(() => {});
  }
}

export function startScheduler() {
  console.log(`[Scheduler] Agendando verificação diária: ${DAILY_CHECK}`);
  cron.schedule(DAILY_CHECK, dailyFinancialCheck, { timezone: "America/Sao_Paulo" });

  console.log(`[Scheduler] Agendando resumo semanal: ${WEEKLY_SUMMARY}`);
  cron.schedule(WEEKLY_SUMMARY, weeklyFinancialSummary, { timezone: "America/Sao_Paulo" });

  console.log("[Scheduler] Agendamentos ativos.");
}
