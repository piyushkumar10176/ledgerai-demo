// All money is stored and computed as INTEGER PENNIES. Never floats for money.

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
