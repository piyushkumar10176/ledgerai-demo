import { listClients } from "./data";
import { one } from "./db";
import { computeVatReturn } from "./vat";

export type ObligationStatus = "filed" | "ready" | "missing";

export interface Obligation {
  clientId: number;
  clientName: string;
  status: ObligationStatus;
  txnCount: number; // journal entries in the period
  reviewCount: number; // receipts sitting in the review queue
  netVat: number | null; // Box 5 (filed = stored, ready = computed), pennies
  formBundle: string | null; // HMRC receipt ref if filed
}

// Build the firm's obligation list for one VAT period. One row per client:
//   filed   (green) = a submitted return exists for the period
//   ready   (amber) = has ledger activity but not filed yet
//   missing (red)   = no data captured for the period
export async function firmObligations(
  firmId: number,
  periodStart: string,
  periodEnd: string,
): Promise<Obligation[]> {
  const clients = await listClients(firmId);
  const out: Obligation[] = [];

  for (const c of clients) {
    const filed = await one<{ box5: number; hmrc_receipt: string | null }>(
      `SELECT box5, hmrc_receipt FROM vat_returns
        WHERE client_id = ? AND period_start = ? AND period_end = ?
          AND status = 'submitted'
        ORDER BY id DESC LIMIT 1`,
      [c.id, periodStart, periodEnd],
    );
    const txn = await one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM journal_entries
        WHERE client_id = ? AND entry_date >= ? AND entry_date <= ?`,
      [c.id, periodStart, periodEnd],
    );
    const rev = await one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM receipts WHERE client_id = ? AND status = 'review'`,
      [c.id],
    );

    const txnCount = txn?.n ?? 0;
    const reviewCount = rev?.n ?? 0;

    let status: ObligationStatus;
    let netVat: number | null = null;
    let formBundle: string | null = null;

    if (filed) {
      status = "filed";
      netVat = filed.box5;
      formBundle = filed.hmrc_receipt
        ? (JSON.parse(filed.hmrc_receipt).formBundleNumber ?? null)
        : null;
    } else if (txnCount > 0) {
      status = "ready";
      netVat = (await computeVatReturn(c.id, periodStart, periodEnd)).box5;
    } else {
      status = "missing";
    }

    out.push({
      clientId: c.id,
      clientName: c.name,
      status,
      txnCount,
      reviewCount,
      netVat,
      formBundle,
    });
  }
  return out;
}
