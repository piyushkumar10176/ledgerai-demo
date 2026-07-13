import { one, run } from "./db";
import { hashPassword } from "./auth";
import { seedSampleData } from "./sample-data";

export const DEMO_EMAIL = "demo@ledgerai.test";
export const DEMO_PASSWORD = "demo1234";

// Idempotently create the demo firm, a login user, and the sample ITSA clients.
export async function ensureDemoData(): Promise<void> {
  let firm = await one<{ id: number }>(`SELECT id FROM firms WHERE name = ?`, [
    "Demo Accountants",
  ]);
  if (!firm) {
    const r = await run(`INSERT INTO firms (name) VALUES (?)`, ["Demo Accountants"]);
    firm = { id: r.lastId };
  }

  const user = await one<{ id: number }>(`SELECT id FROM users WHERE email = ?`, [
    DEMO_EMAIL,
  ]);
  if (!user) {
    await run(
      `INSERT INTO users (firm_id, email, name, role, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [firm.id, DEMO_EMAIL, "Demo Accountant", "Partner", hashPassword(DEMO_PASSWORD)],
    );
  }

  await seedSampleData(firm.id);
}
