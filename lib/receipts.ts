import { one, many, run } from "./db";
import { postEntry } from "./ledger";
import { getAccountByCode } from "./data";
import { runMockOcr, CONFIDENCE_THRESHOLD } from "./ocr-mock";

export interface Receipt {
  id: number;
  filename: string;
  supplier: string | null;
  receipt_date: string | null;
  gross: number | null;
  vat: number | null;
  net: number | null;
  suggested_code: string | null;
  suggested_name: string | null;
  confidence: number | null;
  status: string;
  entry_id: number | null;
}

// DR expense (net) + DR input VAT (vat) == CR Accounts Payable (gross).
// Crediting AP (not Bank) keeps receipts distinct from bank-statement lines.
function postReceiptEntry(
  firmId: number,
  clientId: number,
  date: string,
  supplier: string,
  code: string,
  net: number,
  vat: number,
  gross: number,
): Promise<number> {
  const lines = [
    { accountCode: code, debit: net },
    ...(vat > 0 ? [{ accountCode: "1210", debit: vat }] : []),
    { accountCode: "2100", credit: gross },
  ];
  return postEntry({
    firmId,
    clientId,
    date,
    description: `Receipt: ${supplier}`,
    source: "receipt",
    lines,
  });
}

// Process an uploaded receipt through mock OCR/AI, store it, log the AI
// decision, and either auto-post (>= threshold) or queue for review.
export async function processReceipt(
  firmId: number,
  clientId: number,
  filename: string,
  scenarioKey?: string,
): Promise<{ receiptId: number; autoPosted: boolean; confidence: number }> {
  const ocr = runMockOcr(filename, scenarioKey);
  const acct = await getAccountByCode(clientId, ocr.suggestedCode);
  const suggestedAccountId = acct?.id ?? null;

  const autoPosted = ocr.confidence >= CONFIDENCE_THRESHOLD;
  const status = autoPosted ? "auto_posted" : "review";

  const r = await run(
    `INSERT INTO receipts
       (firm_id, client_id, filename, supplier, receipt_date, gross, vat, net,
        suggested_account_id, confidence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      firmId,
      clientId,
      filename,
      ocr.supplier,
      ocr.date,
      ocr.gross,
      ocr.vat,
      ocr.net,
      suggestedAccountId,
      ocr.confidence,
      status,
    ],
  );
  const receiptId = r.lastId;

  await run(
    `INSERT INTO ai_decisions
       (firm_id, receipt_id, model, input_text, output_json, confidence,
        suggested_account_id, outcome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      firmId,
      receiptId,
      "mock-ocr-ai/v1",
      ocr.rawText,
      JSON.stringify({
        supplier: ocr.supplier,
        gross: ocr.gross,
        vat: ocr.vat,
        net: ocr.net,
        suggestedCode: ocr.suggestedCode,
      }),
      ocr.confidence,
      suggestedAccountId,
      autoPosted ? "auto_posted" : "queued_for_review",
    ],
  );

  if (autoPosted && acct) {
    const entryId = await postReceiptEntry(
      firmId,
      clientId,
      ocr.date,
      ocr.supplier,
      ocr.suggestedCode,
      ocr.net,
      ocr.vat,
      ocr.gross,
    );
    await run(`UPDATE receipts SET entry_id = ? WHERE id = ?`, [
      entryId,
      receiptId,
    ]);
  }

  return { receiptId, autoPosted, confidence: ocr.confidence };
}

export function listReceipts(clientId: number): Promise<Receipt[]> {
  return many<Receipt>(
    `SELECT r.id, r.filename, r.supplier, r.receipt_date, r.gross, r.vat, r.net,
            a.code AS suggested_code, a.name AS suggested_name,
            r.confidence, r.status, r.entry_id
       FROM receipts r
       LEFT JOIN accounts a ON a.id = r.suggested_account_id
      WHERE r.client_id = ?
      ORDER BY r.id DESC`,
    [clientId],
  );
}

// Confirm a queued receipt (optionally overriding the category), then post it.
export async function confirmReceipt(
  firmId: number,
  receiptId: number,
  overrideCode?: string,
): Promise<number> {
  const r = await one<{
    id: number;
    client_id: number;
    supplier: string;
    receipt_date: string;
    gross: number;
    vat: number;
    net: number;
    suggested_account_id: number | null;
    entry_id: number | null;
  }>(`SELECT * FROM receipts WHERE id = ? AND firm_id = ?`, [receiptId, firmId]);
  if (!r) throw new Error("Receipt not found");
  if (r.entry_id) throw new Error("Receipt already posted");

  let code = overrideCode;
  if (!code) {
    const acct = await one<{ code: string }>(
      `SELECT code FROM accounts WHERE id = ?`,
      [r.suggested_account_id],
    );
    code = acct?.code;
  }
  if (!code) throw new Error("No category to post to");

  const entryId = await postReceiptEntry(
    firmId,
    r.client_id,
    r.receipt_date,
    r.supplier,
    code,
    r.net,
    r.vat,
    r.gross,
  );
  await run(
    `UPDATE receipts SET status = 'confirmed', entry_id = ? WHERE id = ?`,
    [entryId, receiptId],
  );

  const overridden = overrideCode != null;
  await run(`UPDATE ai_decisions SET outcome = ? WHERE receipt_id = ?`, [
    overridden ? "overridden" : "confirmed",
    receiptId,
  ]);

  return entryId;
}

export async function rejectReceipt(
  firmId: number,
  receiptId: number,
): Promise<void> {
  const r = await one<{ entry_id: number | null }>(
    `SELECT entry_id FROM receipts WHERE id = ? AND firm_id = ?`,
    [receiptId, firmId],
  );
  if (!r) throw new Error("Receipt not found");
  if (r.entry_id) throw new Error("Cannot reject a posted receipt");
  await run(`UPDATE receipts SET status = 'rejected' WHERE id = ?`, [receiptId]);
  await run(`UPDATE ai_decisions SET outcome = 'rejected' WHERE receipt_id = ?`, [
    receiptId,
  ]);
}
