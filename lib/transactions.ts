import { one, many, run } from "./db";
import { getIncomeSource } from "./data";
import {
  suggestCategory,
  runMockReceiptOcr,
  CONFIDENCE_THRESHOLD,
} from "./categorise-mock";
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
  const suggestion = suggestCategory(t.description, sourceType, t.signedAmount);
  const direction = t.signedAmount > 0 ? "income" : "expense";
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
      firmId, txnId, "mock-categoriser/v1", t.description,
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
  const t = await one<{ id: number; category: string | null }>(
    `SELECT id, category FROM transactions WHERE id = ? AND firm_id = ?`,
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
