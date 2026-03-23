/**
 * Simple in-memory + JSON file storage for:
 * - Pending confirmations (actions awaiting user approval)
 * - Conversation history per phone number
 * - Sent reminders log (to avoid duplicates)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const DATA_FILE = resolve("data.json");

interface PendingConfirmation {
  id: string;
  phone: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

interface SentReminder {
  key: string; // e.g. "stripe:inv_xxx:2024-01-15"
  sentAt: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface DataStore {
  pendingConfirmations: PendingConfirmation[];
  sentReminders: SentReminder[];
  conversations: Record<string, ConversationMessage[]>;
}

function load(): DataStore {
  if (!existsSync(DATA_FILE)) {
    return { pendingConfirmations: [], sentReminders: [], conversations: {} };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf-8")) as DataStore;
}

function save(data: DataStore): void {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Pending Confirmations ────────────────────────────────────────────────────

export function savePendingConfirmation(
  id: string,
  phone: string,
  action: string,
  payload: Record<string, unknown>,
  ttlMinutes = 60
): void {
  const data = load();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  data.pendingConfirmations.push({
    id,
    phone,
    action,
    payload,
    createdAt: new Date().toISOString(),
    expiresAt,
  });
  save(data);
}

export function getPendingConfirmation(
  id: string
): PendingConfirmation | undefined {
  const data = load();
  return data.pendingConfirmations.find(
    (c) => c.id === id && new Date(c.expiresAt) > new Date()
  );
}

export function removePendingConfirmation(id: string): void {
  const data = load();
  data.pendingConfirmations = data.pendingConfirmations.filter((c) => c.id !== id);
  save(data);
}

export function getPendingForPhone(phone: string): PendingConfirmation[] {
  const data = load();
  return data.pendingConfirmations.filter(
    (c) => c.phone === phone && new Date(c.expiresAt) > new Date()
  );
}

// ─── Sent Reminders ───────────────────────────────────────────────────────────

export function wasReminderSent(key: string): boolean {
  const data = load();
  return data.sentReminders.some((r) => r.key === key);
}

export function markReminderSent(key: string): void {
  const data = load();
  if (!data.sentReminders.some((r) => r.key === key)) {
    data.sentReminders.push({ key, sentAt: new Date().toISOString() });
  }
  save(data);
}

// Clean reminders older than 30 days
export function pruneOldReminders(): void {
  const data = load();
  const cutoff = new Date(Date.now() - 30 * 86400_000);
  data.sentReminders = data.sentReminders.filter(
    (r) => new Date(r.sentAt) > cutoff
  );
  save(data);
}

// ─── Conversation History ─────────────────────────────────────────────────────

export function addMessage(
  phone: string,
  role: "user" | "assistant",
  content: string
): void {
  const data = load();
  if (!data.conversations[phone]) data.conversations[phone] = [];
  data.conversations[phone].push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
  // Keep last 30 messages per conversation
  if (data.conversations[phone].length > 30) {
    data.conversations[phone] = data.conversations[phone].slice(-30);
  }
  save(data);
}

export function getHistory(
  phone: string
): Array<{ role: "user" | "assistant"; content: string }> {
  const data = load();
  return (data.conversations[phone] ?? []).map(({ role, content }) => ({
    role,
    content,
  }));
}
