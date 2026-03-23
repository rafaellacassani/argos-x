import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

export interface UpcomingInvoice {
  id: string;
  customer: string;
  customerEmail: string | null;
  amount: number;
  currency: string;
  dueDate: Date | null;
  status: string;
  hostedUrl: string | null;
}

export async function listUpcomingInvoices(daysAhead = 7): Promise<UpcomingInvoice[]> {
  const now = Math.floor(Date.now() / 1000);
  const until = now + daysAhead * 86400;

  const invoices = await stripe.invoices.list({
    status: "open",
    due_date: { lte: until },
    limit: 50,
  });

  return invoices.data.map((inv) => ({
    id: inv.id,
    customer: typeof inv.customer === "string" ? inv.customer : (inv.customer?.id ?? ""),
    customerEmail: typeof inv.customer_email === "string" ? inv.customer_email : null,
    amount: inv.amount_due / 100,
    currency: inv.currency.toUpperCase(),
    dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
    status: inv.status ?? "unknown",
    hostedUrl: inv.hosted_invoice_url ?? null,
  }));
}

export async function sendInvoiceReminder(invoiceId: string): Promise<void> {
  await stripe.invoices.sendInvoice(invoiceId);
}

export async function createPaymentLink(
  customerId: string,
  amount: number,
  currency: string,
  description: string
): Promise<string> {
  const price = await stripe.prices.create({
    unit_amount: Math.round(amount * 100),
    currency: currency.toLowerCase(),
    product_data: { name: description },
  });

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
  });

  return link.url;
}

export async function getCustomerName(customerId: string): Promise<string> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return customerId;
  return customer.name ?? customer.email ?? customerId;
}

export async function listRecentPayments(days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const charges = await stripe.charges.list({
    created: { gte: since },
    limit: 50,
  });

  return charges.data.map((c) => ({
    id: c.id,
    amount: c.amount / 100,
    currency: c.currency.toUpperCase(),
    status: c.status,
    customerEmail: c.billing_details?.email ?? null,
    date: new Date(c.created * 1000),
    description: c.description,
  }));
}
