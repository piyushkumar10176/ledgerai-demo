import { one, many, run } from "./db";
import { seedChartOfAccounts } from "./coa";

export interface Client {
  id: number;
  firm_id: number;
  name: string;
  company_number: string | null;
  vat_number: string | null;
  vat_scheme: string;
  created_at: string;
}

export function listClients(firmId: number): Promise<Client[]> {
  return many<Client>(
    `SELECT * FROM clients WHERE firm_id = ? ORDER BY name`,
    [firmId],
  );
}

// Firm-scoped fetch: resolves to null if the client isn't in this firm.
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
  name: string,
  companyNumber: string | null,
  vatNumber: string | null,
): Promise<number> {
  const r = await run(
    `INSERT INTO clients (firm_id, name, company_number, vat_number)
     VALUES (?, ?, ?, ?)`,
    [firmId, name.trim(), companyNumber?.trim() || null, vatNumber?.trim() || null],
  );
  await seedChartOfAccounts(firmId, r.lastId); // every new client gets the COA
  return r.lastId;
}

export interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  vat_role: string | null;
  is_category: number;
}

export function listAccounts(clientId: number): Promise<Account[]> {
  return many<Account>(
    `SELECT * FROM accounts WHERE client_id = ? ORDER BY code`,
    [clientId],
  );
}

export function listCategoryAccounts(clientId: number): Promise<Account[]> {
  return many<Account>(
    `SELECT * FROM accounts WHERE client_id = ? AND is_category = 1 ORDER BY code`,
    [clientId],
  );
}

export async function getAccountByCode(
  clientId: number,
  code: string,
): Promise<Account | null> {
  return (
    (await one<Account>(
      `SELECT * FROM accounts WHERE client_id = ? AND code = ?`,
      [clientId, code],
    )) ?? null
  );
}

export interface JournalEntryRow {
  id: number;
  entry_date: string;
  description: string;
  source: string;
  total: number;
}

export function listJournalEntries(
  clientId: number,
  limit = 100,
): Promise<JournalEntryRow[]> {
  return many<JournalEntryRow>(
    `SELECT e.id, e.entry_date, e.description, e.source,
            COALESCE((SELECT SUM(debit) FROM journal_lines WHERE entry_id = e.id), 0) AS total
       FROM journal_entries e
      WHERE e.client_id = ?
      ORDER BY e.entry_date DESC, e.id DESC
      LIMIT ?`,
    [clientId, limit],
  );
}
