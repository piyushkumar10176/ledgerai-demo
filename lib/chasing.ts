import { one, many, run } from "./db";
import { logAudit } from "./audit";

const STAGES = ["none", "1st reminder", "2nd chase", "final notice"];

// Record an (escalating) chase for a client's period. Delivery is mocked;
// the schedule + escalation state are real (PRD §6.2 automated chasing).
export async function sendChase(firmId: number, clientId: number, periodKey: string): Promise<{ stage: number; label: string }> {
  const row = await one<{ id: number; stage: number }>(
    `SELECT id, stage FROM chase_schedules WHERE firm_id = ? AND client_id = ? AND period_key = ?`,
    [firmId, clientId, periodKey],
  );
  const stage = Math.min((row?.stage ?? 0) + 1, 3);
  if (row) await run(`UPDATE chase_schedules SET stage = ?, status = 'sent', last_sent = datetime('now'), channel = 'sms' WHERE id = ?`, [stage, row.id]);
  else await run(`INSERT INTO chase_schedules (firm_id, client_id, period_key, stage, status, last_sent, channel) VALUES (?, ?, ?, ?, 'sent', datetime('now'), 'sms')`, [firmId, clientId, periodKey, stage]);
  await logAudit(firmId, "chase.sent", "client", clientId, `${STAGES[stage]} for ${periodKey}`);
  return { stage, label: STAGES[stage] };
}

export interface ChaseRow { client_id: number; stage: number; status: string; last_sent: string | null }

export function listChases(firmId: number, periodKey: string): Promise<ChaseRow[]> {
  return many<ChaseRow>(
    `SELECT client_id, stage, status, last_sent FROM chase_schedules WHERE firm_id = ? AND period_key = ?`,
    [firmId, periodKey],
  );
}
