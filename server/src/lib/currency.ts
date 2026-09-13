// Static, approximate FX rates to USD. These are intentionally not live — they
// are accurate enough to bucket subscriptions by value and to aggregate monthly
// spend across currencies. Never use them for settlement or display of exact FX.
// Maintain manually — see the "Static FX assumption" note in NEXT.md.
// Last set 2026-06-15: $1 ≈ ₦1380.
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  NGN: 1 / 1380,
  CELO: 0.5,
}

const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
}

export function toUsd(amount: number, currency: string): number {
  const rate = USD_RATES[(currency ?? 'USD').toUpperCase()] ?? 1
  return amount * rate
}

// Display symbol for a currency, falling back to the code + space (e.g. "CELO ").
export function currencySymbol(currency: string): string {
  const code = (currency ?? 'USD').toUpperCase()
  return SYMBOLS[code] ?? `${code} `
}
