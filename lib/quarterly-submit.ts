import crypto from "node:crypto";
import { many, one, run } from "./db";
import { getIncomeSource } from "./data";
import { computeQuarterlyUpdate } from "./quarterly";
import { quarterByKey } from "./periods";

export interface StoredQuarterly {
  id: number;
  income_source_id: number;
  period_key: string;
  period_start: string;
  period_end: string;
  income_total: number;
  expense_total: number;
  net_profit: number;
  status: string;
  hmrc_receipt: string | null;
  submitted_at: string | null;
}

// MOCK HMRC submission of a cumulative quarterly update. In production this is
// the HMRC Gateway (OAuth, fraud headers, Self-Employment/Property Business API,
// idempotency, retries). Here: compute deterministically, store, fake a receipt.
export async function submitQuarterlyUpdate(
  firmId: number,
  clientId: number,
  sourceId: number,
  periodKey: string,
): Promise<{ id: number; receipt: Record<string, string> }> {
  const q = quarterByKey(periodKey);
  if (!q) throw new Error("Unknown period");
  const source = await getIncomeSource(firmId, sourceId);
  if (!source) throw new Error("Income source not found");

  const u = await computeQuarterlyUpdate(
    sourceId,
    source.type,
    source.annual_turnover,
    q.taxYearStart,
    q.periodEnd,
  );

  const receipt = {
    transactionReference: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    periodKey,
    processingDate: new Date().toISOString(),
    note: "MOCK receipt — not a real HMRC submission.",
  };

  const r = await run(
    `INSERT INTO quarterly_updates
       (firm_id, client_id, income_source_id, period_key, period_start, period_end,
        income_total, expense_total, net_profit, payload_json, status, hmrc_receipt, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
    [
      firmId, clientId, sourceId, periodKey, q.taxYearStart, q.periodEnd,
      u.incomeTotal, u.expenseTotal, u.netProfit,
      JSON.stringify({ income: u.incomeLines, expenses: u.expenseLines, consolidated: u.consolidated }),
      JSON.stringify(receipt), receipt.processingDate,
    ],
  );
  return { id: r.lastId, receipt };
}

export function listQuarterlySubmissions(
  sourceId: number,
): Promise<StoredQuarterly[]> {
  return many<StoredQuarterly>(
    `SELECT * FROM quarterly_updates WHERE income_source_id = ? ORDER BY id DESC`,
    [sourceId],
  );
}

export function getSubmission(
  sourceId: number,
  periodKey: string,
): Promise<StoredQuarterly | undefined> {
  return one<StoredQuarterly>(
    `SELECT * FROM quarterly_updates
      WHERE income_source_id = ? AND period_key = ? AND status = 'submitted'
      ORDER BY id DESC LIMIT 1`,
    [sourceId, periodKey],
  );
}

// MOCK in-year tax estimate. Real product triggers/retrieves HMRC's Individual
// Calculations API. Here: a simple indicative figure on YTD profit, clearly
// labelled a mock. Never used for a submission.
export function mockTaxEstimate(netProfitPennies: number): {
  estimate: number;
  basis: string;
} {
  const PERSONAL_ALLOWANCE = 1_257_000; // £12,570 in pennies
  const taxable = Math.max(0, netProfitPennies - PERSONAL_ALLOWANCE);
  return {
    estimate: Math.round(taxable * 0.2), // basic-rate indicative
    basis: "Indicative 20% on YTD profit above the personal allowance (mock).",
  };
}
