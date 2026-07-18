import { one, many, run } from "./db";
import { getIncomeSource } from "./data";
import {
  suggestCategory,
  runMockReceiptOcr,
  CONFIDENCE_THRESHOLD,
} from "./categorise-mock";
import { applyRule, saveRule } from "./rules";
import { logAudit } from "./audit";
import type { SourceType } from "./hmrc-categories";
import type { ParsedBankRow } from "./csv";

export interface Txn {
  id: number;
  client_id: number;
  income_source_id: number;
  txn_date: string;
  description: string;
  direction: string;
  category: string | null;
  amount: number;
  source: string;
  confidence: number | null;
  status: string;
}

// Create one categorised transaction. Runs the mock AI categoriser, logs the
// decision, and auto-confirms above the confidence threshold (else -> review).
export async function addTransaction(
  firmId: number,
  clientId: number,
  sourceId: number,
  sourceType: SourceType,
  t: { date: string; description: string; signedAmount: number; source: string; provenance?: string },
): Promise<number> {
  const direction = t.signedAmount > 0 ? "income" : "expense";
  // Learning loop: a learned rule for this supplier beats fresh AI inference.
  const learned = await applyRule(firmId, clientId, t.description);
  const suggestion = learned
    ? { category: learned, direction, confidence: 1.0 }
    : suggestCategory(t.description, sourceType, t.signedAmount);
  const amount = Math.abs(t.signedAmount);
  const status = suggestion.confidence >= CONFIDENCE_THRESHOLD ? "auto" : "review";

  const r = await run(
    `INSERT INTO transactions
       (firm_id, client_id, income_source_id, txn_date, description, direction,
        category, amount, source, provenance, confidence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      firmId, clientId, sourceId, t.date, t.description, direction,
      suggestion.category, amount, t.source, t.provenance ?? null,
      suggestion.confidence, status,
    ],
  );
  const txnId = r.lastId;

  await run(
    `INSERT INTO ai_decisions
       (firm_id, transaction_id, model, input_text, output_json, confidence,
        suggested_category, outcome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      firmId, txnId, learned ? "learned-rule/v1" : "mock-categoriser/v1", t.description,
      JSON.stringify(suggestion), suggestion.confidence, suggestion.category,
      status === "auto" ? "auto" : "queued_for_review",
    ],
  );
  return txnId;
}

export async function importBankCsv(
  firmId: number,
  clientId: number,
  sourceId: number,
  rows: ParsedBankRow[],
): Promise<number> {
  const source = await getIncomeSource(firmId, sourceId);
  if (!source) throw new Error("Income source not found");
  for (const row of rows)
    await addTransaction(firmId, clientId, sourceId, source.type, {
      date: row.date,
      description: row.description,
      signedAmount: row.amount,
      source: "bank",
      provenance: "bank statement",
    });
  return rows.length;
}

export async function addReceipt(
  firmId: number,
  clientId: number,
  sourceId: number,
  filename: string,
  scenarioKey?: string,
): Promise<{ txnId: number; auto: boolean; confidence: number; supplier: string }> {
  const source = await getIncomeSource(firmId, sourceId);
  if (!source) throw new Error("Income source not found");
  const ocr = runMockReceiptOcr(filename, source.type, scenarioKey);
  const txnId = await addTransaction(firmId, clientId, sourceId, source.type, {
    date: ocr.date,
    description: `${ocr.supplier} (receipt)`,
    signedAmount: -ocr.amount, // receipts are expenses
    source: "receipt",
    provenance: filename,
  });
  return {
    txnId,
    auto: ocr.confidence >= CONFIDENCE_THRESHOLD,
    confidence: ocr.confidence,
    supplier: ocr.supplier,
  };
}

export function listTransactions(sourceId: number): Promise<Txn[]> {
  return many<Txn>(
    `SELECT * FROM transactions WHERE income_source_id = ? ORDER BY txn_date, id`,
    [sourceId],
  );
}

export interface ReviewItem extends Txn {
  client_name: string;
  business_name: string;
  source_type: string;
}

// The ★ cross-client exception queue: every low-confidence item, all clients.
export function reviewQueue(firmId: number): Promise<ReviewItem[]> {
  return many<ReviewItem>(
    `SELECT t.*, c.name AS client_name, s.business_name, s.type AS source_type
       FROM transactions t
       JOIN clients c ON c.id = t.client_id
       JOIN income_sources s ON s.id = t.income_source_id
      WHERE t.firm_id = ? AND t.status = 'review'
      ORDER BY t.confidence ASC, t.id`,
    [firmId],
  );
}

export async function confirmTransaction(
  firmId: number,
  txnId: number,
  overrideCategory?: string,
): Promise<void> {
  const t = await one<{ id: number; client_id: number; description: string; category: string | null }>(
    `SELECT id, client_id, description, category FROM transactions WHERE id = ? AND firm_id = ?`,
    [txnId, firmId],
  );
  if (!t) throw new Error("Transaction not found");
  const category = overrideCategory || t.category;
  await run(
    `UPDATE transactions SET status = 'confirmed', category = ? WHERE id = ?`,
    [category, txnId],
  );
  await run(`UPDATE ai_decisions SET outcome = ? WHERE transaction_id = ?`, [
    overrideCategory ? "overridden" : "confirmed",
    txnId,
  ]);
  // Learn: a human override teaches a supplier→category rule for next time.
  if (overrideCategory) await saveRule(firmId, t.client_id, t.description, overrideCategory);
  await logAudit(firmId, overrideCategory ? "txn.recategorised" : "txn.confirmed", "transaction", txnId, category ?? undefined);
}

// Manually add an entry (accountant-entered, auto-confirmed).
export async function createManualTransaction(
  firmId: number,
  clientId: number,
  sourceId: number,
  t: { date: string; description: string; amount: number; direction: string; category: string },
): Promise<number> {
  const r = await run(
    `INSERT INTO transactions
       (firm_id, client_id, income_source_id, txn_date, description, direction, category, amount, source, confidence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', 1.0, 'confirmed')`,
    [firmId, clientId, sourceId, t.date, t.description.trim(), t.direction, t.category, Math.abs(Math.round(t.amount))],
  );
  return r.lastId;
}

// Edit an existing entry (any subset of fields).
export async function updateTransaction(
  firmId: number,
  id: number,
  f: Partial<{ date: string; description: string; amount: number; direction: string; category: string; status: string }>,
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (f.date !== undefined) { sets.push("txn_date = ?"); args.push(f.date); }
  if (f.description !== undefined) { sets.push("description = ?"); args.push(f.description.trim()); }
  if (f.amount !== undefined) { sets.push("amount = ?"); args.push(Math.abs(Math.round(f.amount))); }
  if (f.direction !== undefined) { sets.push("direction = ?"); args.push(f.direction); }
  if (f.category !== undefined) { sets.push("category = ?"); args.push(f.category); }
  if (f.status !== undefined) { sets.push("status = ?"); args.push(f.status); }
  if (sets.length === 0) return;
  args.push(id, firmId);
  await run(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ? AND firm_id = ?`, args);
  await logAudit(firmId, "txn.edited", "transaction", id);
}

// Remove an entry (and its AI-decision audit rows).
export async function deleteTransaction(firmId: number, id: number): Promise<void> {
  await run(`DELETE FROM ai_decisions WHERE transaction_id = ? AND firm_id = ?`, [id, firmId]);
  await run(`DELETE FROM transactions WHERE id = ? AND firm_id = ?`, [id, firmId]);
  await logAudit(firmId, "txn.deleted", "transaction", id);
}

export async function rejectTransaction(
  firmId: number,
  txnId: number,
): Promise<void> {
  await run(
    `UPDATE transactions SET status = 'rejected' WHERE id = ? AND firm_id = ?`,
    [txnId, firmId],
  );
  await run(`UPDATE ai_decisions SET outcome = 'rejected' WHERE transaction_id = ?`, [
    txnId,
  ]);
}
