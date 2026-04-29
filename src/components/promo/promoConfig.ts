// ============================================================================
// ANNUAL PROMO 2026 — single source of truth for the promo deadline
// ----------------------------------------------------------------------------
// Promo válida até 30/04/2026 23:59:59 (America/Sao_Paulo) = 2026-05-01 02:59:59 UTC.
// Se for prorrogar/encerrar, MUDE APENAS AQUI.
// O servidor (`annual-promo-checkout`) usa o mesmo timestamp.
// ============================================================================
export const PROMO_END_ISO = "2026-05-01T02:59:59Z";

export function getPromoEndDate(): Date {
  return new Date(PROMO_END_ISO);
}

export function isPromoActive(now: Date = new Date()): boolean {
  return now.getTime() < getPromoEndDate().getTime();
}

export interface PromoCountdown {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function getPromoCountdown(now: Date = new Date()): PromoCountdown {
  const total = getPromoEndDate().getTime() - now.getTime();
  if (total <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { total, days, hours, minutes, seconds, expired: false };
}

export function pad(n: number): string {
  return n.toString().padStart(2, "0");
}