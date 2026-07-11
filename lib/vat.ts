import { one } from "./db";

export interface VatReturn {
  box1: number; box2: number; box3: number; box4: number; box5: number;
  box6: number; box7: number; box8: number; box9: number;
}

/**
 * DETERMINISTIC VAT calculation. Reads the ledger and computes the 9-box return
 * with plain arithmetic. NO AI, NO estimation — same inputs, same figures
 * (compliance invariant VAT-01).
 *
 *   Box 1 = net movement CREDITED to the output-VAT control account
 *   Box 4 = net movement DEBITED to the input-VAT control account
 *   Box 6 = net movement CREDITED to INCOME accounts (sales ex-VAT)
 *   Box 7 = net movement DEBITED to EXPENSE accounts (purchases ex-VAT)
 */
export async function computeVatReturn(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<VatReturn> {
  const sumWhere = async (clause: string): Promise<number> => {
    const row = await one<{ d: number; c: number }>(
      `SELECT COALESCE(SUM(l.debit), 0) AS d, COALESCE(SUM(l.credit), 0) AS c
         FROM journal_lines l
         JOIN journal_entries e ON e.id = l.entry_id
         JOIN accounts a ON a.id = l.account_id
        WHERE e.client_id = @clientId
          AND e.entry_date >= @start AND e.entry_date <= @end
          AND ${clause}`,
      { clientId, start: periodStart, end: periodEnd },
    );
    return (row?.d ?? 0) - (row?.c ?? 0); // signed: debit-positive
  };

  const box1 = -(await sumWhere("a.vat_role = 'output'")); // output VAT is credited
  const box2 = 0;
  const box3 = box1 + box2;
  const box4 = await sumWhere("a.vat_role = 'input'"); // input VAT is debited
  const box5 = Math.abs(box3 - box4);
  const box6 = -(await sumWhere("a.type = 'INCOME'"));
  const box7 = await sumWhere("a.type = 'EXPENSE'");
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
