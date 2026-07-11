import { getDb } from "./db";
import { postEntry } from "./ledger";
import { splitGross } from "./money";
import type { ParsedBankRow } from "./csv";

export interface BankTxn {
  id: number;
  txn_date: string;
  description: string;
  amount: number; // pennies, signed
  entry_id: number | null;
}

export function importBankRows(
  firmId: number,
  clientId: number,
  rows: ParsedBankRow[],
): number {
  const db = getDb();
  const batch = new Date().toISOString(); // batch label
  const stmt = db.prepare(
    `INSERT INTO bank_transactions (firm_id, client_id, txn_date, description, amount, batch)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const r of rows)
      stmt.run(firmId, clientId, r.date, r.description, r.amount, batch);
  });
  tx();
  return rows.length;
}

export function listBankTransactions(clientId: number): BankTxn[] {
  return getDb()
    .prepare(
      `SELECT id, txn_date, description, amount, entry_id
         FROM bank_transactions WHERE client_id = ?
        ORDER BY txn_date, id`,
    )
    .all(clientId) as BankTxn[];
}

export type VatTreatment = "standard" | "none";

/**
 * Categorise one imported bank line into a balanced double-entry posting.
 * Money in  -> income (credit income + output VAT, debit bank).
 * Money out -> expense (debit expense + input VAT, credit bank).
 * VAT is split deterministically from the gross amount.
 */
export function categoriseBankTransaction(
  firmId: number,
  txnId: number,
  accountCode: string,
  vat: VatTreatment,
): number {
  const db = getDb();
  const txn = db
    .prepare(
      `SELECT * FROM bank_transactions WHERE id = ? AND firm_id = ?`,
    )
    .get(txnId, firmId) as
    | { id: number; client_id: number; txn_date: string; description: string; amount: number; entry_id: number | null }
    | undefined;
  if (!txn) throw new Error("Bank transaction not found");
  if (txn.entry_id) throw new Error("Already categorised");

  const gross = Math.abs(txn.amount);
  const isIncome = txn.amount > 0;
  const split = vat === "standard" ? splitGross(gross) : { net: gross, vat: 0 };

  const lines = isIncome
    ? [
        { accountCode: "1200", debit: gross }, // Bank
        { accountCode, credit: split.net }, // Income
        ...(split.vat > 0
          ? [{ accountCode: "2200", credit: split.vat }] // Output VAT
          : []),
      ]
    : [
        { accountCode, debit: split.net }, // Expense
        ...(split.vat > 0
          ? [{ accountCode: "1210", debit: split.vat }] // Input VAT
          : []),
        { accountCode: "1200", credit: gross }, // Bank
      ];

  const entryId = postEntry({
    firmId,
    clientId: txn.client_id,
    date: txn.txn_date,
    description: txn.description,
    source: "bank_import",
    lines,
  });
  db.prepare(`UPDATE bank_transactions SET entry_id = ? WHERE id = ?`).run(
    entryId,
    txnId,
  );
  return entryId;
}
