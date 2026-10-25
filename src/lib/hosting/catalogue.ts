export type HostingPlan = 'basis' | 'pro' | 'premium';
export const HOSTING_BANK = { beneficiary: 'Kevin Bourguignon', iban: 'BE43738004886701', formattedIban: 'BE43 7380 0488 6701' } as const;
export const PLANS = {
  basis: { name: 'Basis', objects: 150, database: 500e6, media: 1e9, direct: 5e9, cached: 5e9 },
  pro: { name: 'Pro', objects: 300, database: 8e9, media: 100e9, direct: 250e9, cached: 500e9 },
  premium: { name: 'Premium', objects: 500, database: 20e9, media: 500e9, direct: 1e12, cached: 2e12 },
} as const;
export const PRODUCTS = {
  extra50: { label: '+50 objecten', cents: 2500, extra: 50, plan: null, months: 0, bankLabel: 'Uitbreiding 50 Kunstwerken' },
  extra150: { label: '+150 objecten', cents: 5000, extra: 150, plan: null, months: 0, bankLabel: 'Uitbreiding 150 Kunstwerken' },
  pro_month: { label: 'Pro · maandelijks', cents: 2500, extra: 0, plan: 'pro', months: 1, bankLabel: 'Pro Plan Maandelijks' },
  pro_year: { label: 'Pro · jaarlijks', cents: 24000, extra: 0, plan: 'pro', months: 12, bankLabel: 'Pro Plan Jaarlijks' },
  premium_month: { label: 'Premium · maandelijks', cents: 4900, extra: 0, plan: 'premium', months: 1, bankLabel: 'Premium Plan Maandelijks' },
  premium_year: { label: 'Premium · jaarlijks', cents: 49000, extra: 0, plan: 'premium', months: 12, bankLabel: 'Premium Plan Jaarlijks' },
} as const;
export type HostingProduct = keyof typeof PRODUCTS;
export function paymentPayload(code: HostingProduct) {
  return `BCD\n002\n1\nSCT\n\n${HOSTING_BANK.beneficiary}\n${HOSTING_BANK.iban}\nEUR${(PRODUCTS[code].cents / 100).toFixed(2)}\n\n${PRODUCTS[code].bankLabel}`;
}
export function objectUsage(count: number, limit: number) {
  const percentage = limit > 0 ? count / limit * 100 : 0;
  return { percentage, fill: Math.min(100, Math.max(0, percentage)), over: Math.max(0, count - limit), tone: count >= limit ? 'danger' : percentage >= 80 ? 'warning' : 'normal' };
}
export function formatBytes(bytes: number) {
  return new Intl.NumberFormat('nl-BE', { maximumFractionDigits: bytes < 1e9 ? 1 : 3 }).format(bytes / (bytes >= 1e12 ? 1e12 : bytes >= 1e9 ? 1e9 : 1e6)) + (bytes >= 1e12 ? ' TB' : bytes >= 1e9 ? ' GB' : ' MB');
}
export type HostingMetric = { value: number | null; measuredAt: string | null; status: 'ready' | 'unavailable' | 'not_applicable' | 'error'; periodStart?: string; periodEnd?: string };
export type HostingOrder = { id: string; product: HostingProduct; cents: number; status: 'pending_payment' | 'payment_review' | 'active' | 'cancelled'; createdAt: string; activatedAt: string | null };
export type HostingReport = { plan: HostingPlan; extra: number; count: number; limit: number; validUntil: string | null; metrics: { media: HostingMetric; database: HostingMetric; direct: HostingMetric; cached: HostingMetric }; orders: HostingOrder[]; updatedAt: string; local?: boolean };
