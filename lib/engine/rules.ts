// The fiscal parameters of MTD IT mandation, versioned as data: Parliament
// amends parameters at Budgets, so thresholds live here and never inline.
// Source: Income Tax (Digital Obligations) Regulations 2026 (SI 2026/336) —
// qualifying-income thresholds keyed to the LOOK-BACK tax year:
//   2024-25 → £50,000 (mandation 6 Apr 2026)
//   2025-26 → £30,000 (mandation 6 Apr 2027)
//   2026-27 and every later year → £20,000 (mandation 6 Apr 2028+)
// Money is INTEGER PENNIES throughout (matching the app's convention).
// Faithful port of LedgerAI.Domain.Triage.MandationRuleSet — keep in sync.

import type { TaxYear } from "./tax-year";

export interface MandationRules {
  firstLookBackYear: number;
  /** Deferred groups (SA109/SA107/averaging/qualifying-care/non-resident
   *  entertainers) cannot be mandated before this date [SI 2026/336 Ch 6]. */
  deferredGroupsEarliestMandation: string; // ISO date
  /** Consecutive below-threshold MTD years required before opt-out. */
  exitRuleConsecutiveYears: number;
}

export const CURRENT_RULES: MandationRules = {
  firstLookBackYear: 2024,
  deferredGroupsEarliestMandation: "2027-04-06",
  exitRuleConsecutiveYears: 3,
};

/** Threshold in pennies for a look-back year, or null if no MTD mandation existed. */
export function thresholdFor(y: TaxYear): number | null {
  if (y.startYear < 2024) return null;
  if (y.startYear === 2024) return 5_000_000; // £50,000
  if (y.startYear === 2025) return 3_000_000; // £30,000
  return 2_000_000; // £20,000 — 2026-27 and every later year
}

/** Mandation always begins on 6 April two years after the look-back year starts. */
export function mandationStartFor(y: TaxYear): string {
  return `${y.startYear + 2}-04-06`;
}

export type Wave = "none" | "wave1-2026" | "wave2-2027" | "wave3-2028plus";

export function waveFor(mandationStartIso: string): Wave {
  const year = Number(mandationStartIso.slice(0, 4));
  if (year === 2026) return "wave1-2026";
  if (year === 2027) return "wave2-2027";
  return "wave3-2028plus";
}

export function waveLabel(w: Wave): string {
  switch (w) {
    case "wave1-2026": return "Wave 1 · April 2026";
    case "wave2-2027": return "Wave 2 · April 2027";
    case "wave3-2028plus": return "Wave 3 · April 2028+";
    default: return "—";
  }
}
