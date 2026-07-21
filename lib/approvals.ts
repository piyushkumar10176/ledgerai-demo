import { one, run } from "./db";
import { logAudit } from "./audit";

// Client approval of the quarterly figures (Phase 2: magic-link approval).
export async function recordApproval(
  firmId: number, clientId: number, periodKey: string, via = "magic-link",
): Promise<void> {
  await run(
    `INSERT INTO approvals (firm_id, client_id, period_key, approved_at, approved_via)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(client_id, period_key) DO UPDATE SET approved_at = datetime('now'), approved_via = excluded.approved_via`,
    [firmId, clientId, periodKey, via],
  );
  await logAudit(firmId, "client.approved", "client", clientId, `${periodKey} via ${via}`);
}

export async function getApproval(clientId: number, periodKey: string): Promise<{ approved_at: string; approved_via: string } | null> {
  return (await one<{ approved_at: string; approved_via: string }>(
    `SELECT approved_at, approved_via FROM approvals WHERE client_id = ? AND period_key = ?`,
    [clientId, periodKey],
  )) ?? null;
}
