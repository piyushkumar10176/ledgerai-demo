import { db, one, many, run } from "./db";
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

export async function importBankRows(
  firmId: number,
  clientId: number,
  rows: ParsedBankRow[],
): Promise<number> {
  const client = await db();
  const batch = new Date().toISOString();
  const stmts = rows.map((r) => ({
    sql: `INSERT INTO bank_transactions
            (firm_id, client_id, txn_date, description, amount, batch)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [firmId, clientId, r.date, r.description, r.amount, batch] as (
      | string
      | number
    )[],
  }));
  await client.batch(stmts, "write");
  return rows.length;
}

export function listBankTransactions(clientId: number): Promise<BankTxn[]> {
  return many<BankTxn>(
    `SELECT id, txn_date, description, amount, entry_id
       FROM bank_transactions WHERE client_id = ?
      ORDER BY txn_date, id`,
    [clientId],
  );
}

export type VatTreatment = "standard" | "none";

/**
 * Categorise one imported bank line into a balanced double-entry posting.
 * Money in  -> income (credit income + output VAT, debit bank).
 * Money out -> expense (debit expense + input VAT, credit bank).
 */
export async function categoriseBankTransaction(
  firmId: number,
  txnId: number,
  accountCode: string,
  vat: VatTreatment,
): Promise<number> {
  const txn = await one<{
    id: number;
    client_id: number;
    txn_date: string;
    description: string;
    amount: number;
    entry_id: number | null;
  }>(`SELECT * FROM bank_transactions WHERE id = ? AND firm_id = ?`, [
    txnId,
    firmId,
  ]);
  if (!txn) throw new Error("Bank transaction not found");
  if (txn.entry_id) throw new Error("Already categorised");

  const gross = Math.abs(txn.amount);
  const isIncome = txn.amount > 0;
  const split = vat === "standard" ? splitGross(gross) : { net: gross, vat: 0 };

  const lines = isIncome
    ? [
        { accountCode: "1200", debit: gross },
        { accountCode, credit: split.net },
        ...(split.vat > 0 ? [{ accountCode: "2200", credit: split.vat }] : []),
      ]
    : [
        { accountCode, debit: split.net },
        ...(split.vat > 0 ? [{ accountCode: "1210", debit: split.vat }] : []),
        { accountCode: "1200", credit: gross },
      ];

  const entryId = await postEntry({
    firmId,
    clientId: txn.client_id,
    date: txn.txn_date,
    description: txn.description,
    source: "bank_import",
    lines,
  });
  await run(`UPDATE bank_transactions SET entry_id = ? WHERE id = ?`, [
    entryId,
    txnId,
  ]);
  return entryId;
}
