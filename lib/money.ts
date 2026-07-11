// All money in this app is stored and computed as INTEGER PENNIES.
// Never use floats for money — floating point rounding corrupts a ledger.

export function poundsToPennies(pounds: number): number {
  return Math.round(pounds * 100);
}

export function penniesToPounds(pennies: number): number {
  return pennies / 100;
}

export function formatGBP(pennies: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pennies / 100);
}

// Standard-rate UK VAT = 20%. VAT on a NET amount, rounded to the nearest penny.
export const STANDARD_VAT_RATE = 0.2;

export function vatOnNet(netPennies: number, rate = STANDARD_VAT_RATE): number {
  return Math.round(netPennies * rate);
}

// Split a VAT-inclusive gross amount into { net, vat } at a given rate.
export function splitGross(
  grossPennies: number,
  rate = STANDARD_VAT_RATE,
): { net: number; vat: number } {
  const net = Math.round(grossPennies / (1 + rate));
  return { net, vat: grossPennies - net };
}
