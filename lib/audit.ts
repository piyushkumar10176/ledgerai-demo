import { many, run } from "./db";

// Append-only audit trail (PRD §7 audit log).
export async function logAudit(
  firmId: number,
  action: string,
  entity?: string,
  entityId?: number,
  detail?: string,
): Promise<void> {
  await run(
    `INSERT INTO audit_events (firm_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)`,
    [firmId, action, entity ?? null, entityId ?? null, detail ?? null],
  );
}

export interface AuditRow {
  id: number;
  action: string;
  entity: string | null;
  entity_id: number | null;
  detail: string | null;
  created_at: string;
}

export function listAudit(firmId: number, limit = 200): Promise<AuditRow[]> {
  return many<AuditRow>(
    `SELECT id, action, entity, entity_id, detail, created_at FROM audit_events WHERE firm_id = ? ORDER BY id DESC LIMIT ?`,
    [firmId, limit],
  );
}
