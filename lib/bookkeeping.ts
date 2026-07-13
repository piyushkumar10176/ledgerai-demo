import { many } from "./db";
import { categoryLabel, type SourceType } from "./hmrc-categories";

export interface CoaAccount {
  category: string;
  label: string;
  type: "income" | "expense";
  balance: number; // pennies
  count: number;
}

// A chart of accounts derived from the client's categorised transactions
// (aggregated across all income sources). Each account is clickable to its ledger.
export async function chartOfAccounts(clientId: number): Promise<{
  income: CoaAccount[];
  expenses: CoaAccount[];
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
}> {
  const rows = await many<{ category: string; direction: string; source_type: SourceType; total: number; n: number }>(
    `SELECT t.category, t.direction, s.type AS source_type,
            COALESCE(SUM(t.amount),0) AS total, COUNT(*) AS n
       FROM transactions t
       JOIN income_sources s ON s.id = t.income_source_id
      WHERE t.client_id = ? AND t.status IN ('auto','confirmed') AND t.category IS NOT NULL
      GROUP BY t.category, t.direction
      ORDER BY total DESC`,
    [clientId],
  );

  const income: CoaAccount[] = [];
  const expenses: CoaAccount[] = [];
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const r of rows) {
    const acc: CoaAccount = {
      category: r.category,
      label: categoryLabel(r.source_type, r.category),
      type: r.direction as "income" | "expense",
      balance: r.total,
      count: r.n,
    };
    if (r.direction === "income") { income.push(acc); incomeTotal += r.total; }
    else { expenses.push(acc); expenseTotal += r.total; }
  }

  return { income, expenses, incomeTotal, expenseTotal, netProfit: incomeTotal - expenseTotal };
}

export interface FeedTxn {
  id: number;
  client_id: number;
  client_name: string;
  business_name: string;
  txn_date: string;
  description: string;
  direction: string;
  category: string | null;
  source_type: string;
  amount: number;
  status: string;
  confidence: number | null;
}

// Practice-wide recent transactions across every client (the Bookkeeping feed).
export function practiceFeed(firmId: number, limit = 60): Promise<FeedTxn[]> {
  return many<FeedTxn>(
    `SELECT t.id, t.client_id, c.name AS client_name, s.business_name, s.type AS source_type,
            t.txn_date, t.description, t.direction, t.category, t.amount, t.status, t.confidence
       FROM transactions t
       JOIN clients c ON c.id = t.client_id
       JOIN income_sources s ON s.id = t.income_source_id
      WHERE t.firm_id = ?
      ORDER BY t.txn_date DESC, t.id DESC
      LIMIT ?`,
    [firmId, limit],
  );
}

export interface LedgerTxn {
  id: number;
  txn_date: string;
  description: string;
  amount: number;
  direction: string;
  status: string;
  business_name: string;
}

// The ledger for one account (category) — all transactions posted to it.
export function accountLedger(clientId: number, category: string): Promise<LedgerTxn[]> {
  return many<LedgerTxn>(
    `SELECT t.id, t.txn_date, t.description, t.amount, t.direction, t.status, s.business_name
       FROM transactions t JOIN income_sources s ON s.id = t.income_source_id
      WHERE t.client_id = ? AND t.category = ? AND t.status IN ('auto','confirmed')
      ORDER BY t.txn_date, t.id`,
    [clientId, category],
  );
}
