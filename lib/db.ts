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
    "file:./data/ledgerai.db";
  const authToken =
    process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken, intMode: "number" });
  await client.executeMultiple(SCHEMA);
  return client;
}

export async function db(): Promise<Client> {
  if (_client) return _client;
  if (!_init) _init = build().then((c) => (_client = c));
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
