import { listClients, listIncomeSources } from "./data";
import { one } from "./db";
import { computeQuarterlyUpdate } from "./quarterly";
import { getSubmission } from "./quarterly-submit";
import type { Quarter } from "./periods";

export type ObligationStatus = "filed" | "ready" | "missing";

export interface Obligation {
  clientId: number;
  clientName: string;
  mandationStatus: string;
  agentAuth: string;
  sourceId: number;
  businessName: string;
  sourceType: string;
  status: ObligationStatus;
  reviewCount: number;
  netProfit: number | null; // pennies
  filedRef: string | null;
}

// Every client × income source obligation for the given quarter (PRD §6.6).
export async function firmObligations(
  firmId: number,
  quarter: Quarter,
): Promise<Obligation[]> {
  const clients = await listClients(firmId);
  const out: Obligation[] = [];

  for (const c of clients) {
    const sources = await listIncomeSources(c.id);
    for (const s of sources) {
      const filed = await getSubmission(s.id, quarter.key);
      const posted = await one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transactions
          WHERE income_source_id = ? AND status IN ('auto','confirmed')
            AND txn_date >= ? AND txn_date <= ?`,
        [s.id, quarter.taxYearStart, quarter.periodEnd],
      );
      const review = await one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transactions
          WHERE income_source_id = ? AND status = 'review'`,
        [s.id],
      );

      let status: ObligationStatus;
      let netProfit: number | null = null;
      let filedRef: string | null = null;

      if (filed) {
        status = "filed";
        netProfit = filed.net_profit;
        filedRef = filed.hmrc_receipt
          ? (JSON.parse(filed.hmrc_receipt).transactionReference ?? null)
          : null;
      } else if ((posted?.n ?? 0) > 0) {
        status = "ready";
        const u = await computeQuarterlyUpdate(
          s.id,
          s.type,
          s.annual_turnover,
          quarter.taxYearStart,
          quarter.periodEnd,
        );
        netProfit = u.netProfit;
      } else {
        status = "missing";
      }

      out.push({
        clientId: c.id,
        clientName: c.name,
        mandationStatus: c.mandation_status,
        agentAuth: c.agent_auth_status,
        sourceId: s.id,
        businessName: s.business_name,
        sourceType: s.type,
        status,
        reviewCount: review?.n ?? 0,
        netProfit,
        filedRef,
      });
    }
  }
  return out;
}
