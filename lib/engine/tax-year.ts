// A UK tax year identified by its starting calendar year: 2024 = 2024-25,
// running 6 April 2024 to 5 April 2025. Faithful port of the verified .NET
// engine (LedgerAI.Domain.Triage.TaxYear) — keep the two in sync.

export interface TaxYear {
  startYear: number;
}

export function taxYear(startYear: number): TaxYear {
  return { startYear };
}

export function taxYearLabel(y: TaxYear): string {
  return `${y.startYear}-${String((y.startYear + 1) % 100).padStart(2, "0")}`;
}

/** Accepts "2024-25", "2024/25", "2024-2025" or "2024". */
export function parseTaxYear(label: string): TaxYear {
  const head = label.trim().split(/[-/]/)[0];
  const y = Number(head);
  if (!Number.isInteger(y) || y < 2000 || y > 2100)
    throw new Error(`Unrecognised tax year label '${label}'.`);
  return { startYear: y };
}

/** The tax year containing a calendar date (ISO yyyy-mm-dd). */
export function taxYearOfDate(iso: string): TaxYear {
  const [y, m, d] = iso.split("-").map(Number);
  const beforeApril6 = m < 4 || (m === 4 && d < 6);
  return { startYear: beforeApril6 ? y - 1 : y };
}
