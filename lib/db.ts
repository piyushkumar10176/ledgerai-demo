import { createClient, type Client, type InArgs } from "@libsql/client";

// Data store: libSQL. Local dev uses a file DB; production (Vercel) points at a
// Turso database via env vars.
//   TURSO_DATABASE_URL / TURSO_AUTH_TOKEN

let _client: Client | null = null;
let _init: Promise<Client> | null = null;

// MTD Income Tax schema (PRD §8). Single-entry digital records (transactions),
// summed into cumulative quarterly updates. Every tenant row carries firm_id.
// Money is INTEGER pennies.
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

-- Layer 0: client setup.
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  nino TEXT,
  utr TEXT,
  dob TEXT,
  mandation_status TEXT NOT NULL DEFAULT 'unknown', -- mandated | voluntary | not_mandated | unknown
  mandation_wave TEXT,                              -- 2026 | 2027 | 2028
  agent_auth_status TEXT NOT NULL DEFAULT 'missing', -- linked | pending | missing
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS income_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL CHECK (type IN ('self-employment','uk-property')),
  business_name TEXT NOT NULL,
  hmrc_business_id TEXT,
  accounting_method TEXT NOT NULL DEFAULT 'cash', -- cash | accruals
  annual_turnover INTEGER NOT NULL DEFAULT 0,      -- pennies, for the £90k mode
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Layer 1: digital records (single-entry categorised transactions).
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  income_source_id INTEGER NOT NULL REFERENCES income_sources(id),
  txn_date TEXT NOT NULL,
  description TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income','expense')),
  category TEXT,                                   -- HMRC category code (null until categorised)
  amount INTEGER NOT NULL,                         -- pennies, absolute
  source TEXT NOT NULL DEFAULT 'manual',           -- bank | receipt | manual
  provenance TEXT,                                 -- e.g. filename / bank line
  confidence REAL,                                 -- AI confidence 0..1
  status TEXT NOT NULL DEFAULT 'review',           -- review | auto | confirmed | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_txn_client ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_txn_source ON transactions(income_source_id);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(status);

-- Audit of every AI decision (PRD AIDecision).
CREATE TABLE IF NOT EXISTS ai_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  transaction_id INTEGER REFERENCES transactions(id),
  model TEXT NOT NULL,
  input_text TEXT,
  output_json TEXT,
  confidence REAL,
  suggested_category TEXT,
  reviewer_user_id INTEGER REFERENCES users(id),
  outcome TEXT,                                    -- auto | confirmed | overridden | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Layer 2: quarterly cumulative update submissions.
CREATE TABLE IF NOT EXISTS quarterly_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  income_source_id INTEGER NOT NULL REFERENCES income_sources(id),
  period_key TEXT NOT NULL,                        -- 2026Q1 ...
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  income_total INTEGER NOT NULL,
  expense_total INTEGER NOT NULL,
  net_profit INTEGER NOT NULL,
  payload_json TEXT NOT NULL,                      -- the per-category cumulative totals
  status TEXT NOT NULL DEFAULT 'submitted',
  hmrc_receipt TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Look-back-year gross income per client (TRI-02..05): the inputs to the REAL
-- mandation engine (lib/engine). One row per client + tax year + source.
-- Distinct from income_sources (live businesses with transactions): these are
-- the historic return figures the legal test runs on. Pennies.
CREATE TABLE IF NOT EXISTS source_year_income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  tax_year_start INTEGER NOT NULL,                 -- 2024 = 2024-25
  type TEXT NOT NULL,                              -- engine QiSourceType
  description TEXT,
  gross_income INTEGER NOT NULL,                   -- pennies, GROSS (never profit)
  share_percent REAL NOT NULL DEFAULT 100,
  months_active INTEGER NOT NULL DEFAULT 12,
  alt_annualisation INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_syi_client ON source_year_income(client_id, tax_year_start);

-- Magic links for zero-login client data collection.
CREATE TABLE IF NOT EXISTS magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  used_at TEXT
);

-- Which services each client has engaged the firm for (multi-select).
CREATE TABLE IF NOT EXISTS client_services (
  client_id INTEGER NOT NULL REFERENCES clients(id),
  service TEXT NOT NULL,   -- bookkeeping | vat | mtd-itsa | payroll
  PRIMARY KEY (client_id, service)
);

-- Practice-wide invoicing.
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  number TEXT NOT NULL,
  amount INTEGER NOT NULL,            -- pennies
  issued_date TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid | overdue
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stored HMRC OAuth tokens (per firm agent connection).
CREATE TABLE IF NOT EXISTS hmrc_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  kind TEXT NOT NULL DEFAULT 'agent',   -- agent (user-restricted) | application
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

async function build(): Promise<Client> {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    // On Vercel the bundle filesystem is read-only; /tmp works per warm
    // instance and ensureDemoData re-seeds on cold start. Fine for the demo —
    // set TURSO_DATABASE_URL for durable data.
    (process.env.VERCEL ? "file:/tmp/ledgerai.db" : "file:./data/ledgerai.db");
  const authToken =
    process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken, intMode: "number" });
  await client.executeMultiple(SCHEMA);
  // Idempotent additive migrations (SQLite has no ADD COLUMN IF NOT EXISTS;
  // a duplicate-column error just means it already ran).
  const MIGRATIONS = [
    "ALTER TABLE clients ADD COLUMN vrn TEXT",
    "ALTER TABLE clients ADD COLUMN mtd_it_id TEXT",
    // Real mandation engine inputs (SI 2026/336 exemption/deferral markers)
    "ALTER TABLE clients ADD COLUMN is_uk_resident INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE clients ADD COLUMN files_sa900 INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN files_sa700 INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN lloyds_underwriter INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN minister_of_religion INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN power_of_attorney INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN mca_bpa INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN files_sa109 INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN files_sa107 INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN claims_averaging INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN qualifying_care INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN nonres_entertainer INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN voluntary_signup INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE clients ADD COLUMN digital_exclusion TEXT NOT NULL DEFAULT 'not-applied'",
    "ALTER TABLE clients ADD COLUMN ceased_on TEXT",
    // Real mandation engine outputs
    "ALTER TABLE clients ADD COLUMN mandation_from TEXT",
    "ALTER TABLE clients ADD COLUMN mandation_reasons TEXT",
  ];
  for (const sql of MIGRATIONS) {
    try {
      await client.execute(sql);
    } catch {
      /* column already exists */
    }
  }
  return client;
}

export async function db(): Promise<Client> {
  if (_client) return _client;
  if (!_init)
    _init = build().then(async (c) => {
      _client = c;
      // Ephemeral-DB mode (Vercel /tmp, no Turso): every serverless instance
      // self-seeds on first touch so any route lands on a populated demo —
      // otherwise only the login instance would have data.
      if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
        const { ensureDemoData } = await import("./seed");
        await ensureDemoData().catch(() => {});
      }
      return c;
    });
  return _init;
}

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
