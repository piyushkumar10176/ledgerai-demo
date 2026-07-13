import { one, many, run } from "./db";
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
