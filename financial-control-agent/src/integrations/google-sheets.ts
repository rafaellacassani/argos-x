import { google } from "googleapis";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
}

export interface SheetRow {
  [key: string]: string;
}

export async function readSheet(
  spreadsheetId: string,
  range: string
): Promise<SheetRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  if (rows.length === 0) return [];

  const headers = rows[0].map(String);
  return rows.slice(1).map((row) => {
    const obj: SheetRow = {};
    headers.forEach((h, i) => {
      obj[h] = String(row[i] ?? "");
    });
    return obj;
  });
}

export async function appendRow(
  spreadsheetId: string,
  range: string,
  values: string[]
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function updateCell(
  spreadsheetId: string,
  range: string,
  value: string
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}

export async function listSheets(spreadsheetId: string): Promise<string[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets ?? []).map((s) => s.properties?.title ?? "");
}

export function resolveSheetId(alias: string): string {
  if (alias === "personal" || alias === "familia" || alias === "família")
    return process.env.GOOGLE_SHEET_ID ?? process.env.GOOGLE_SHEET_ID_PERSONAL!;
  if (alias === "clients" || alias === "empresa")
    return process.env.GOOGLE_SHEET_ID ?? process.env.GOOGLE_SHEET_ID_CLIENTS!;
  return alias;
}

export async function getUpcomingPersonalPayments(daysAhead = 7): Promise<SheetRow[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID ?? process.env.GOOGLE_SHEET_ID_PERSONAL!;
  const rows = await readSheet(sheetId, "Família!A:Z").catch(() =>
    readSheet(sheetId, "Pagamentos!A:Z")
  );

  const today = new Date();
  const until = new Date();
  until.setDate(today.getDate() + daysAhead);

  return rows.filter((row) => {
    const vencimento = row["Vencimento"] || row["vencimento"] || row["Data"] || row["data"];
    if (!vencimento) return false;
    const [day, month, year] = vencimento.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    return date >= today && date <= until && (row["Status"] || row["status"]) !== "Pago";
  });
}
