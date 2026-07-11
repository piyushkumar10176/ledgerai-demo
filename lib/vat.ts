import { getDb } from "./db";

// The UK VAT return, boxes 1-9, all in pennies.
export interface VatReturn {
  box1: number; // VAT due on sales (output tax)
  box2: number; // VAT due on acquisitions from EU (out of scope here -> 0)
  box3: number; // total VAT due = box1 + box2
  box4: number; // VAT reclaimed on purchases (input tax)
  box5: number; // net VAT to pay HMRC (or reclaim) = |box3 - box4|
  box6: number; // total value of sales ex-VAT
  box7: number; // total value of purchases ex-VAT
  box8: number; // goods supplied to EU ex-VAT (out of scope -> 0)
  box9: number; // goods acquired from EU ex-VAT (out of scope -> 0)
}

/**
 * DETERMINISTIC VAT calculation. Reads the ledger directly and computes the
 * 9-box return with plain arithmetic. NO AI, NO estimation — the same inputs
 * always produce the same figures. This is the compliance invariant (VAT-01).
 *
 * Derivation from the double-entry ledger, over [periodStart, periodEnd]:
 *   Box 1 = net movement CREDITED to the output-VAT control account
 *   Box 4 = net movement DEBITED to the input-VAT control account
 *   Box 6 = net movement CREDITED to INCOME accounts (sales ex-VAT)
 *   Box 7 = net movement DEBITED to EXPENSE accounts (purchases ex-VAT)
 */
export function computeVatReturn(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): VatReturn {
  const db = getDb();

  const sumWhere = (clause: string): number => {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(l.debit), 0) AS d, COALESCE(SUM(l.credit), 0) AS c
           FROM journal_lines l
           JOIN journal_entries e ON e.id = l.entry_id
           JOIN accounts a ON a.id = l.account_id
          WHERE e.client_id = @clientId
            AND e.entry_date >= @start AND e.entry_date <= @end
            AND ${clause}`,
      )
      .get({ clientId, start: periodStart, end: periodEnd }) as {
      d: number;
      c: number;
    };
    return row.d - row.c; // signed: debit-positive
  };

  // Output VAT is credited (a liability grows on the credit side) -> credit-positive.
  const box1 = -sumWhere("a.vat_role = 'output'");
  const box2 = 0;
  const box3 = box1 + box2;
  // Input VAT is debited (an asset/reclaimable grows on the debit side) -> debit-positive.
  const box4 = sumWhere("a.vat_role = 'input'");
  const box5 = Math.abs(box3 - box4);
  // Income is credit-positive; expenses are debit-positive.
  const box6 = -sumWhere("a.type = 'INCOME'");
  const box7 = sumWhere("a.type = 'EXPENSE'");
  const box8 = 0;
  const box9 = 0;

  return { box1, box2, box3, box4, box5, box6, box7, box8, box9 };
}

export const VAT_BOX_LABELS: Record<keyof VatReturn, string> = {
  box1: "VAT due on sales and other outputs",
  box2: "VAT due on acquisitions from EU member states",
  box3: "Total VAT due (Box 1 + Box 2)",
  box4: "VAT reclaimed on purchases and other inputs",
  box5: "Net VAT to pay to HMRC or reclaim",
  box6: "Total value of sales and other outputs excluding VAT",
  box7: "Total value of purchases and other inputs excluding VAT",
  box8: "Total value of goods supplied to EU member states excluding VAT",
  box9: "Total value of goods acquired from EU member states excluding VAT",
};
