import { one, run } from "./db";
import { seedChartOfAccounts } from "./coa";
import { hashPassword } from "./auth";
import { seedSampleData } from "./sample-data";

// Demo login credentials (shown on the login screen).
export const DEMO_EMAIL = "demo@ledgerai.test";
export const DEMO_PASSWORD = "demo1234";

// Idempotently create the demo firm, a login user, and the sample clients.
// Safe to call on every request; only inserts what's missing.
export async function ensureDemoData(): Promise<void> {
  let firm = await one<{ id: number }>(
    `SELECT id FROM firms WHERE name = ?`,
    ["Demo Accountants"],
  );
  if (!firm) {
    const r = await run(`INSERT INTO firms (name) VALUES (?)`, [
      "Demo Accountants",
    ]);
    firm = { id: r.lastId };
  }

  const user = await one<{ id: number }>(
    `SELECT id FROM users WHERE email = ?`,
    [DEMO_EMAIL],
  );
  if (!user) {
    await run(
      `INSERT INTO users (firm_id, email, name, role, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [firm.id, DEMO_EMAIL, "Demo Accountant", "Partner", hashPassword(DEMO_PASSWORD)],
    );
  }

  const client = await one<{ id: number }>(
    `SELECT id FROM clients WHERE firm_id = ? AND name = ?`,
    [firm.id, "Bright Bakery Ltd"],
  );
  if (!client) {
    const r = await run(
      `INSERT INTO clients (firm_id, name, company_number, vat_number)
       VALUES (?, ?, ?, ?)`,
      [firm.id, "Bright Bakery Ltd", "09876543", "GB123456789"],
    );
    await seedChartOfAccounts(firm.id, r.lastId);
  }

  // Populate the sample clients too, so a fresh database always shows a
  // populated product. Idempotent — skips clients that already have data.
  await seedSampleData(firm.id);
}

// Ensure a firm + client exist (idempotent) with a seeded chart of accounts.
export async function ensureFirmAndClient(
  firmName: string,
  clientName: string,
): Promise<{ firmId: number; clientId: number }> {
  let firm = await one<{ id: number }>(`SELECT id FROM firms WHERE name = ?`, [
    firmName,
  ]);
  if (!firm) {
    const r = await run(`INSERT INTO firms (name) VALUES (?)`, [firmName]);
    firm = { id: r.lastId };
  }

  let client = await one<{ id: number }>(
    `SELECT id FROM clients WHERE firm_id = ? AND name = ?`,
    [firm.id, clientName],
  );
  if (!client) {
    const r = await run(
      `INSERT INTO clients (firm_id, name, vat_number) VALUES (?, ?, ?)`,
      [firm.id, clientName, "GB123456789"],
    );
    client = { id: r.lastId };
  }

  await seedChartOfAccounts(firm.id, client.id);
  return { firmId: firm.id, clientId: client.id };
}
