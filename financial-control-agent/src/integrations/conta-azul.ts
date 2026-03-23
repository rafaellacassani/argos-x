import axios from "axios";

// Conta Azul uses OAuth2 — tokens are refreshed automatically
let accessToken = process.env.CONTA_AZUL_ACCESS_TOKEN ?? "";
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const res = await axios.post(
    "https://api.contaazul.com/auth/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.CONTA_AZUL_CLIENT_ID!,
      client_secret: process.env.CONTA_AZUL_CLIENT_SECRET!,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  accessToken = res.data.access_token;
  tokenExpiry = Date.now() + res.data.expires_in * 1000 - 60_000;
  return accessToken;
}

function api() {
  return axios.create({
    baseURL: "https://api.contaazul.com/v1",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export interface ContaAzulSale {
  id: string;
  number: string;
  status: string;
  customer_name: string;
  total: number;
  due_date: string;
  emit_date: string;
}

export async function listOpenSales(): Promise<ContaAzulSale[]> {
  await getToken();
  const res = await api().get("/sales", {
    params: { status: "PENDING", page: 0, size: 50 },
  });
  return res.data ?? [];
}

export async function getSaleDetail(saleId: string) {
  await getToken();
  const res = await api().get(`/sales/${saleId}`);
  return res.data;
}

export interface ContaAzulCustomer {
  id: string;
  name: string;
  email: string;
  document: string;
}

export async function listCustomers(): Promise<ContaAzulCustomer[]> {
  await getToken();
  const res = await api().get("/customers", { params: { page: 0, size: 50 } });
  return res.data ?? [];
}

export async function emitServiceInvoice(saleId: string): Promise<{ nfseUrl?: string }> {
  await getToken();
  const res = await api().post(`/sales/${saleId}/nfse`);
  return res.data;
}

export async function getUpcomingSales(daysAhead = 7): Promise<ContaAzulSale[]> {
  const sales = await listOpenSales();
  const today = new Date();
  const until = new Date();
  until.setDate(today.getDate() + daysAhead);

  return sales.filter((s) => {
    if (!s.due_date) return false;
    const due = new Date(s.due_date);
    return due >= today && due <= until;
  });
}
