import { many, one } from "./db";
import {
  categoryLabel,
  CONSOLIDATION_THRESHOLD,
  type SourceType,
} from "./hmrc-categories";

export interface QuarterLine {
  code: string;
  label: string;
  amount: number; // pennies
}

export interface QuarterlyUpdate {
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
  consolidated: boolean; // true => expenses are a single figure (< £90k)
  incomeLines: QuarterLine[];
  expenseLines: QuarterLine[]; // if consolidated, one line "consolidatedExpenses"
  txnCount: number;
}

/**
 * DETERMINISTIC cumulative quarterly update (PRD §8 Layer 2). Sums the client's
 * confirmed/auto transactions for one income source from the tax-year start to
 * the period end. Pure arithmetic — AI never produces these figures.
 */
export async function computeQuarterlyUpdate(
  sourceId: number,
  sourceType: SourceType,
  annualTurnover: number,
  taxYearStart: string,
  periodEnd: string,
): Promise<QuarterlyUpdate> {
  const rows = await many<{ category: string; direction: string; total: number }>(
    `SELECT category, direction, COALESCE(SUM(amount),0) AS total
       FROM transactions
      WHERE income_source_id = ?
        AND status IN ('auto','confirmed')
        AND category IS NOT NULL
        AND txn_date >= ? AND txn_date <= ?
      GROUP BY category, direction
      ORDER BY category`,
    [sourceId, taxYearStart, periodEnd],
  );

  const countRow = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions
      WHERE income_source_id = ? AND status IN ('auto','confirmed')
        AND txn_date >= ? AND txn_date <= ?`,
    [sourceId, taxYearStart, periodEnd],
  );

  const incomeLines: QuarterLine[] = [];
  const expenseLines: QuarterLine[] = [];
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const r of rows) {
    if (r.direction === "income") {
      incomeTotal += r.total;
      incomeLines.push({ code: r.category, label: categoryLabel(sourceType, r.category), amount: r.total });
    } else {
      expenseTotal += r.total;
      expenseLines.push({ code: r.category, label: categoryLabel(sourceType, r.category), amount: r.total });
    }
  }

  // £90k threshold applies per income source.
  const consolidated = annualTurnover < CONSOLIDATION_THRESHOLD;
  const finalExpenseLines: QuarterLine[] = consolidated
    ? [{ code: "consolidatedExpenses", label: "Total allowable expenses (consolidated)", amount: expenseTotal }]
    : expenseLines;

  return {
    incomeTotal,
    expenseTotal,
    netProfit: incomeTotal - expenseTotal,
    consolidated,
    incomeLines,
    expenseLines: finalExpenseLines,
    txnCount: countRow?.n ?? 0,
  };
}

// Simple pre-submission validation against basic HMRC-shaped rules.
export function validateQuarter(u: QuarterlyUpdate): string[] {
  const errors: string[] = [];
  if (u.txnCount === 0) errors.push("No transactions in the period.");
  if (u.incomeTotal === 0 && u.expenseTotal === 0)
    errors.push("Both income and expenses are zero.");
  return errors;
}
