import { createClient, type Client, type InArgs } from "@libsql/client";

// Data store: libSQL. Local dev uses a file DB; production (Vercel) points at a
// Turso database via env vars. Same code path either way.
//   TURSO_DATABASE_URL  e.g. libsql://your-db.turso.io   (falls back to a local file)
//   TURSO_AUTH_TOKEN    Turso auth token (not needed for the local file)

let _client: Client | null = null;
let _init: Promise<Client> | null = null;

// Schema (SQLite dialect — libSQL is SQLite). Every tenant-scoped table carries
// firm_id. Money is INTEGER pennies. Journal is append-only (correct via reversal).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS firms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Accountant',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  company_number TEXT,
  vat_number TEXT,
  vat_scheme TEXT NOT NULL DEFAULT 'standard',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  vat_role TEXT CHECK (vat_role IN ('output','input')),
  is_category INTEGER NOT NULL DEFAULT 0,
  UNIQUE(client_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  reverses_entry_id INTEGER REFERENCES journal_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS idx_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_client ON journal_entries(client_id);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  txn_date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  batch TEXT NOT NULL,
  entry_id INTEGER REFERENCES journal_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  filename TEXT NOT NULL,
  supplier TEXT,
  receipt_date TEXT,
  gross INTEGER,
  vat INTEGER,
  net INTEGER,
  suggested_account_id INTEGER REFERENCES accounts(id),
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'review',
  entry_id INTEGER REFERENCES journal_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  receipt_id INTEGER REFERENCES receipts(id),
  model TEXT NOT NULL,
  input_text TEXT,
  output_json TEXT,
  confidence REAL,
  suggested_account_id INTEGER REFERENCES accounts(id),
  reviewer_user_id INTEGER REFERENCES users(id),
  outcome TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vat_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  box1 INTEGER NOT NULL, box2 INTEGER NOT NULL, box3 INTEGER NOT NULL,
  box4 INTEGER NOT NULL, box5 INTEGER NOT NULL, box6 INTEGER NOT NULL,
  box7 INTEGER NOT NULL, box8 INTEGER NOT NULL, box9 INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  hmrc_receipt TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

async function build(): Promise<Client> {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    "file:./data/ledgerai.db";
  const authToken =
    process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken, intMode: "number" });
  await client.executeMultiple(SCHEMA);
  return client;
}

// Memoized client (survives warm serverless invocations + dev hot-reload).
export async function db(): Promise<Client> {
  if (_client) return _client;
  if (!_init) _init = build().then((c) => (_client = c));
  return _init;
}

// --- small query helpers so callers stay tidy ---

export async function one<T>(
  sql: string,
  args: InArgs = [],
): Promise<T | undefined> {
  const rs = await (await db()).execute({ sql, args });
  return rs.rows[0] as T | undefined;
}

export async function many<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const rs = await (await db()).execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function run(
  sql: string,
  args: InArgs = [],
): Promise<{ lastId: number; changes: number }> {
  const rs = await (await db()).execute({ sql, args });
  return { lastId: Number(rs.lastInsertRowid ?? 0), changes: rs.rowsAffected };
}
