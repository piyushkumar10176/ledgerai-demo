// TRI-02/03/04/05: qualifying income for one look-back tax year.
// Qualifying income is the individual's combined GROSS income — self-employment
// turnover plus their beneficial share of gross property rents — before any
// expenses, allowances or reliefs. Partnership shares, PAYE, dividends, pensions,
// qualifying-care receipts, transition profits, one-off land transactions and
// REIT/PAIF income are excluded. Non-UK residents count UK property and UK
// self-employment only. Part-year sources are annualised for the test.
// Faithful port of LedgerAI.Domain.Triage.QualifyingIncomeCalculator.
// Money is integer pennies.

import type { TaxYear } from "./tax-year";

export type QiSourceType =
  | "self-employment"
  | "uk-property"
  | "foreign-property"
  | "partnership-share"
  | "employment"
  | "dividends"
  | "pension"
  | "qualifying-care"
  | "transition-profits"
  | "one-off-land"
  | "reit-paif"
  | "other";

export interface QiSourceYear {
  type: QiSourceType;
  description?: string | null;
  grossIncome: number; // pennies
  sharePercent: number; // 100 for sole ownership
  monthsActive: number; // 1..12
  altAnnualisation?: boolean; // "unreasonable or unjust" alternative method claimed
}

export interface SourceContribution {
  type: QiSourceType;
  description: string | null;
  grossIncome: number;
  sharePercent: number;
  monthsActive: number;
  countedAmount: number;
  counted: boolean;
  note: string;
}

export interface YearQualifyingIncome {
  year: TaxYear;
  total: number; // pennies
  sources: SourceContribution[];
  requiresManualReview: boolean;
}

const PROPERTY_TYPES: QiSourceType[] = ["uk-property", "foreign-property"];

function isCounted(
  type: QiSourceType,
  isUkResident: boolean,
): { counted: boolean; note: string } {
  switch (type) {
    case "self-employment":
      return { counted: true, note: "Gross trading turnover counted." };
    case "uk-property":
      return { counted: true, note: "Gross rents counted (beneficial share)." };
    case "foreign-property":
      return isUkResident
        ? { counted: true, note: "Foreign property counted for UK residents (beneficial share)." }
        : { counted: false, note: "Foreign property excluded for non-UK residents." };
    case "partnership-share":
      return { counted: false, note: "Partnership profit share excluded — partnerships have no mandation date." };
    case "employment":
      return { counted: false, note: "PAYE employment income excluded." };
    case "dividends":
      return { counted: false, note: "Dividends excluded (incl. own-company)." };
    case "pension":
      return { counted: false, note: "Pension income excluded." };
    case "qualifying-care":
      return { counted: false, note: "Qualifying care relief receipts excluded entirely." };
    case "transition-profits":
      return { counted: false, note: "Basis-period transition profits excluded." };
    case "one-off-land":
      return { counted: false, note: "One-off UK land transaction excluded." };
    case "reit-paif":
      return { counted: false, note: "UK REIT/PAIF income excluded." };
    default:
      return { counted: false, note: "Not part of qualifying income." };
  }
}

export function computeQualifyingIncome(
  year: TaxYear,
  sourcesForYear: QiSourceYear[],
  isUkResident: boolean,
): YearQualifyingIncome {
  const contributions: SourceContribution[] = [];
  let manualReview = false;

  for (const s of sourcesForYear) {
    const { counted, note: baseNote } = isCounted(s.type, isUkResident);
    let note = baseNote;
    let amount = 0;

    if (counted) {
      // Beneficial share applies to jointly-held property; a trade has no
      // ownership share, so a sub-100% share on a trade is ignored with a note.
      const isProperty = PROPERTY_TYPES.includes(s.type);
      const share = isProperty ? Math.min(Math.max(s.sharePercent, 0), 100) : 100;
      if (!isProperty && s.sharePercent !== 100)
        note += " Share% ignored for non-property source.";

      amount = (s.grossIncome * share) / 100;

      if (s.monthsActive > 0 && s.monthsActive < 12) {
        if (s.altAnnualisation) {
          note += ` Part-year (${s.monthsActive}m) NOT annualised — alternative method claimed; review manually.`;
          manualReview = true;
        } else {
          amount = (amount * 12) / s.monthsActive;
          note += ` Annualised from ${s.monthsActive} months.`;
        }
      }
    }

    contributions.push({
      type: s.type,
      description: s.description ?? null,
      grossIncome: s.grossIncome,
      sharePercent: s.sharePercent,
      monthsActive: s.monthsActive,
      countedAmount: Math.round(amount),
      counted,
      note: note.trim(),
    });
  }

  const total = contributions
    .filter((c) => c.counted)
    .reduce((sum, c) => sum + c.countedAmount, 0);

  return { year, total: Math.round(total), sources: contributions, requiresManualReview: manualReview };
}
