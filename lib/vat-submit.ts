import crypto from "node:crypto";
import { many, run } from "./db";
import { computeVatReturn } from "./vat";

export interface StoredVatReturn {
  id: number;
  period_start: string;
  period_end: string;
  box1: number; box2: number; box3: number; box4: number; box5: number;
  box6: number; box7: number; box8: number; box9: number;
  status: string;
  hmrc_receipt: string | null;
  submitted_at: string | null;
}

// MOCK HMRC submission. In production this is the HMRC Gateway module:
// OAuth 2.0, fraud-prevention headers, MTD VAT API, idempotency, retries.
// Here we compute deterministically, store it, and return a fake receipt.
export async function submitVatReturn(
  firmId: number,
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<{ returnId: number; receipt: Record<string, string> }> {
  const vat = await computeVatReturn(clientId, periodStart, periodEnd);

  const receipt = {
    formBundleNumber: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    chargeRefNumber:
      "XM" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(),
    processingDate: new Date().toISOString(),
    note: "MOCK receipt — not a real HMRC submission.",
  };

  const r = await run(
    `INSERT INTO vat_returns
       (firm_id, client_id, period_start, period_end,
        box1, box2, box3, box4, box5, box6, box7, box8, box9,
        status, hmrc_receipt, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
    [
      firmId, clientId, periodStart, periodEnd,
      vat.box1, vat.box2, vat.box3, vat.box4, vat.box5,
      vat.box6, vat.box7, vat.box8, vat.box9,
      JSON.stringify(receipt), receipt.processingDate,
    ],
  );

  return { returnId: r.lastId, receipt };
}

export function listVatReturns(clientId: number): Promise<StoredVatReturn[]> {
  return many<StoredVatReturn>(
    `SELECT * FROM vat_returns WHERE client_id = ? ORDER BY id DESC`,
    [clientId],
  );
}
