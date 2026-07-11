import { getDb } from "./db";
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

export function listClients(firmId: number): Client[] {
  return getDb()
    .prepare(`SELECT * FROM clients WHERE firm_id = ? ORDER BY name`)
    .all(firmId) as Client[];
}

// Firm-scoped fetch: returns null if the client doesn't belong to this firm.
export function getClient(firmId: number, clientId: number): Client | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM clients WHERE id = ? AND firm_id = ?`)
      .get(clientId, firmId) as Client | undefined) ?? null
  );
}

export function createClient(
  firmId: number,
  name: string,
  companyNumber: string | null,
  vatNumber: string | null,
): number {
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO clients (firm_id, name, company_number, vat_number)
       VALUES (?, ?, ?, ?)`,
    )
    .run(firmId, name.trim(), companyNumber?.trim() || null, vatNumber?.trim() || null);
  const clientId = Number(r.lastInsertRowid);
  seedChartOfAccounts(firmId, clientId); // every new client gets the COA
  return clientId;
}

export interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  vat_role: string | null;
  is_category: number;
}

export function listAccounts(clientId: number): Account[] {
  return getDb()
    .prepare(`SELECT * FROM accounts WHERE client_id = ? ORDER BY code`)
    .all(clientId) as Account[];
}

// Expense accounts offered as categorisation targets.
export function listCategoryAccounts(clientId: number): Account[] {
  return getDb()
    .prepare(
      `SELECT * FROM accounts WHERE client_id = ? AND is_category = 1 ORDER BY code`,
    )
    .all(clientId) as Account[];
}

export function getAccountByCode(clientId: number, code: string): Account | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM accounts WHERE client_id = ? AND code = ?`)
      .get(clientId, code) as Account | undefined) ?? null
  );
}

export interface JournalEntryRow {
  id: number;
  entry_date: string;
  description: string;
  source: string;
  total: number;
}

// Recent journal entries with their total (sum of debits) for display.
export function listJournalEntries(clientId: number, limit = 100): JournalEntryRow[] {
  return getDb()
    .prepare(
      `SELECT e.id, e.entry_date, e.description, e.source,
              COALESCE((SELECT SUM(debit) FROM journal_lines WHERE entry_id = e.id), 0) AS total
         FROM journal_entries e
        WHERE e.client_id = ?
        ORDER BY e.entry_date DESC, e.id DESC
        LIMIT ?`,
    )
    .all(clientId, limit) as JournalEntryRow[];
}

export interface JournalLineRow {
  entry_id: number;
  code: string;
  name: string;
  debit: number;
  credit: number;
}

export function listJournalLines(clientId: number): JournalLineRow[] {
  return getDb()
    .prepare(
      `SELECT l.entry_id, a.code, a.name, l.debit, l.credit
         FROM journal_lines l
         JOIN journal_entries e ON e.id = l.entry_id
         JOIN accounts a ON a.id = l.account_id
        WHERE e.client_id = ?
        ORDER BY l.entry_id DESC, l.id`,
    )
    .all(clientId) as JournalLineRow[];
}
