import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "ledgerai.db");

// Cache the connection across Next dev hot-reloads.
declare global {
  // eslint-disable-next-line no-var
  var __ledgerDb: Database.Database | undefined;
}

// Full schema. Every tenant-scoped table carries firm_id (multi-tenancy handle).
// Money columns are INTEGER pennies. Journal entries/lines are append-only:
// corrections are made by posting a REVERSAL, never by editing a posted entry.
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

-- Chart of accounts, per client.
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

-- Double-entry journal: header + lines. Append-only.
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL,               -- manual | bank_import | receipt | reversal
  reverses_entry_id INTEGER REFERENCES journal_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit INTEGER NOT NULL DEFAULT 0,   -- pennies
  credit INTEGER NOT NULL DEFAULT 0,  -- pennies
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS idx_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_client ON journal_entries(client_id);

-- Imported bank statement rows (step 4).
CREATE TABLE IF NOT EXISTS bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  txn_date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,            -- pennies; +credit into bank, -debit out
  batch TEXT NOT NULL,
  entry_id INTEGER REFERENCES journal_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Receipts + OCR/AI results (step 5).
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  filename TEXT NOT NULL,
  supplier TEXT,
  receipt_date TEXT,
  gross INTEGER,                      -- pennies
  vat INTEGER,                        -- pennies
  net INTEGER,                        -- pennies
  suggested_account_id INTEGER REFERENCES accounts(id),
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'review', -- review | auto_posted | confirmed | rejected
  entry_id INTEGER REFERENCES journal_entries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit of every AI decision, for explainability (per FRD DOC/AI requirements).
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
  outcome TEXT,                       -- auto_posted | confirmed | overridden | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- VAT returns (step 6). 9 boxes stored in pennies; deterministic, code-computed.
CREATE TABLE IF NOT EXISTS vat_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  box1 INTEGER NOT NULL, box2 INTEGER NOT NULL, box3 INTEGER NOT NULL,
  box4 INTEGER NOT NULL, box5 INTEGER NOT NULL, box6 INTEGER NOT NULL,
  box7 INTEGER NOT NULL, box8 INTEGER NOT NULL, box9 INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | submitted
  hmrc_receipt TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function getDb(): Database.Database {
  if (globalThis.__ledgerDb) return globalThis.__ledgerDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  globalThis.__ledgerDb = db;
  return db;
}
