import { one, many, run } from "./db";
import { logAudit } from "./audit";
import type { SourceType } from "./hmrc-categories";

export interface Client {
  id: number;
  firm_id: number;
  name: string;
  nino: string | null;
  utr: string | null;
  dob: string | null;
  mandation_status: string;
  mandation_wave: string | null;
  agent_auth_status: string;
  phone: string | null;
  vrn: string | null;
  mtd_it_id: string | null;
  created_at: string;
}

export function listClients(firmId: number): Promise<Client[]> {
  return many<Client>(
    `SELECT * FROM clients WHERE firm_id = ? ORDER BY name`,
    [firmId],
  );
}

export async function getClient(
  firmId: number,
  clientId: number,
): Promise<Client | null> {
  return (
    (await one<Client>(`SELECT * FROM clients WHERE id = ? AND firm_id = ?`, [
      clientId,
      firmId,
    ])) ?? null
  );
}

export async function createClient(
  firmId: number,
  fields: { name: string; nino?: string; utr?: string; phone?: string },
): Promise<number> {
  const r = await run(
    `INSERT INTO clients (firm_id, name, nino, utr, phone)
     VALUES (?, ?, ?, ?, ?)`,
    [
      firmId,
      fields.name.trim(),
      fields.nino?.trim() || null,
      fields.utr?.trim() || null,
      fields.phone?.trim() || null,
    ],
  );
  return r.lastId;
}

// Edit a client's details (name, NINO, UTR, phone, VRN).
export async function updateClientInfo(
  firmId: number,
  id: number,
  f: Partial<{ name: string; nino: string; utr: string; phone: string; vrn: string; dob: string }>,
): Promise<void> {
  const cols: [keyof typeof f, string][] = [["name", "name"], ["nino", "nino"], ["utr", "utr"], ["phone", "phone"], ["vrn", "vrn"], ["dob", "dob"]];
  const sets: string[] = [];
  const args: (string | number)[] = [];
  for (const [k, col] of cols) {
    if (f[k] !== undefined) { sets.push(`${col} = ?`); args.push(String(f[k]).trim()); }
  }
  if (sets.length === 0) return;
  args.push(id, firmId);
  await run(`UPDATE clients SET ${sets.join(", ")} WHERE id = ? AND firm_id = ?`, args);
  await logAudit(firmId, "client.edited", "client", id, Object.keys(f).join(", "));
}

export interface IncomeSource {
  id: number;
  client_id: number;
  type: SourceType;
  business_name: string;
  hmrc_business_id: string | null;
  accounting_method: string;
  annual_turnover: number;
}

export function listIncomeSources(clientId: number): Promise<IncomeSource[]> {
  return many<IncomeSource>(
    `SELECT * FROM income_sources WHERE client_id = ? ORDER BY id`,
    [clientId],
  );
}

export async function getIncomeSource(
  firmId: number,
  sourceId: number,
): Promise<IncomeSource | null> {
  return (
    (await one<IncomeSource>(
      `SELECT * FROM income_sources WHERE id = ? AND firm_id = ?`,
      [sourceId, firmId],
    )) ?? null
  );
}

export async function createIncomeSource(
  firmId: number,
  clientId: number,
  fields: {
    type: SourceType;
    businessName: string;
    accountingMethod?: string;
    annualTurnover?: number;
  },
): Promise<number> {
  const r = await run(
    `INSERT INTO income_sources
       (firm_id, client_id, type, business_name, hmrc_business_id, accounting_method, annual_turnover)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      firmId,
      clientId,
      fields.type,
      fields.businessName.trim(),
      "XBIS" + Math.floor(100000 + (clientId * 7 + firmId) * 13).toString(),
      fields.accountingMethod || "cash",
      fields.annualTurnover ?? 0,
    ],
  );
  return r.lastId;
}
