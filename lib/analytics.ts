import { many } from "./db";

export interface MonthPoint { month: string; income: number; expense: number }

// Real monthly income vs expense across the practice (confirmed/auto entries).
export async function monthlyCashflow(firmId: number): Promise<MonthPoint[]> {
  const rows = await many<{ ym: string; direction: string; total: number }>(
    `SELECT strftime('%Y-%m', txn_date) AS ym, direction, COALESCE(SUM(amount),0) AS total
       FROM transactions
      WHERE firm_id = ? AND status IN ('auto','confirmed')
      GROUP BY ym, direction
      ORDER BY ym`,
    [firmId],
  );
  const map = new Map<string, MonthPoint>();
  for (const r of rows) {
    const p = map.get(r.ym) ?? { month: r.ym, income: 0, expense: 0 };
    if (r.direction === "income") p.income += r.total; else p.expense += r.total;
    map.set(r.ym, p);
  }
  return [...map.values()];
}

// Count of auto-categorised (AI) entries this quarter, for the insights card.
export async function autoCategorisedCount(firmId: number): Promise<number> {
  const r = await many<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions WHERE firm_id = ? AND status = 'auto'`,
    [firmId],
  );
  return r[0]?.n ?? 0;
}
