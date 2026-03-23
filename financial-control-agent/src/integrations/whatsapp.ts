import axios from "axios";

const BASE_URL = process.env.EVOLUTION_API_URL!;
const API_KEY = process.env.EVOLUTION_API_KEY!;
const INSTANCE = process.env.EVOLUTION_INSTANCE!;

const client = axios.create({
  baseURL: `${BASE_URL}/message`,
  headers: {
    apikey: API_KEY,
    "Content-Type": "application/json",
  },
});

export async function sendText(to: string, text: string): Promise<void> {
  await client.post(`/sendText/${INSTANCE}`, {
    number: to,
    text,
  });
}

export async function sendButtons(
  to: string,
  title: string,
  description: string,
  buttons: Array<{ id: string; text: string }>
): Promise<void> {
  await client.post(`/sendButtons/${INSTANCE}`, {
    number: to,
    title,
    description,
    buttons: buttons.map((b) => ({
      buttonId: b.id,
      buttonText: { displayText: b.text },
      type: 1,
    })),
    headerType: 1,
  });
}

export async function notifyOwner(text: string): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE!;
  await sendText(ownerPhone, text);
}
