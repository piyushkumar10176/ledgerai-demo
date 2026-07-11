import { getDb } from "./db";
import { seedChartOfAccounts } from "./coa";
import { hashPassword } from "./auth";
import { seedSampleData } from "./sample-data";

// Demo login credentials (shown on the login screen).
export const DEMO_EMAIL = "demo@ledgerai.test";
export const DEMO_PASSWORD = "demo1234";

// Idempotently create the demo firm, a login user, and one sample client.
// Safe to call on every request; only inserts what's missing.
export function ensureDemoData(): void {
  const db = getDb();

  let firm = db
    .prepare(`SELECT id FROM firms WHERE name = ?`)
    .get("Demo Accountants") as { id: number } | undefined;
  if (!firm) {
    const r = db
      .prepare(`INSERT INTO firms (name) VALUES (?)`)
      .run("Demo Accountants");
    firm = { id: Number(r.lastInsertRowid) };
  }

  const user = db
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get(DEMO_EMAIL) as { id: number } | undefined;
  if (!user) {
    db.prepare(
      `INSERT INTO users (firm_id, email, name, role, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      firm.id,
      DEMO_EMAIL,
      "Demo Accountant",
      "Partner",
      hashPassword(DEMO_PASSWORD),
    );
  }

  const client = db
    .prepare(`SELECT id FROM clients WHERE firm_id = ? AND name = ?`)
    .get(firm.id, "Bright Bakery Ltd") as { id: number } | undefined;
  if (!client) {
    const r = db
      .prepare(
        `INSERT INTO clients (firm_id, name, company_number, vat_number)
         VALUES (?, ?, ?, ?)`,
      )
      .run(firm.id, "Bright Bakery Ltd", "09876543", "GB123456789");
    seedChartOfAccounts(firm.id, Number(r.lastInsertRowid));
  }

  // Populate the sample clients too, so a fresh (e.g. just-restarted, ephemeral)
  // database always shows a populated product. Idempotent — skips work if the
  // sample clients already have data.
  seedSampleData(firm.id);
}

// Ensure a firm + client exist (idempotent), with a seeded chart of accounts.
// Returns their ids. Used by later steps and by the ledger self-test.
export function ensureFirmAndClient(
  firmName: string,
  clientName: string,
): { firmId: number; clientId: number } {
  const db = getDb();

  let firm = db
    .prepare(`SELECT id FROM firms WHERE name = ?`)
    .get(firmName) as { id: number } | undefined;
  if (!firm) {
    const r = db.prepare(`INSERT INTO firms (name) VALUES (?)`).run(firmName);
    firm = { id: Number(r.lastInsertRowid) };
  }

  let client = db
    .prepare(`SELECT id FROM clients WHERE firm_id = ? AND name = ?`)
    .get(firm.id, clientName) as { id: number } | undefined;
  if (!client) {
    const r = db
      .prepare(`INSERT INTO clients (firm_id, name, vat_number) VALUES (?, ?, ?)`)
      .run(firm.id, clientName, "GB123456789");
    client = { id: Number(r.lastInsertRowid) };
  }

  seedChartOfAccounts(firm.id, client.id);
  return { firmId: firm.id, clientId: client.id };
}
