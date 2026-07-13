import { db } from "./db";

// Clear TRANSACTIONAL data for a firm (transactions, AI decisions, quarterly
// updates, magic links) while keeping firms, users, clients and income sources.
export async function resetFirmTransactions(firmId: number): Promise<void> {
  const client = await db();
  await client.batch(
    [
      { sql: `DELETE FROM ai_decisions WHERE firm_id = ?`, args: [firmId] },
      { sql: `DELETE FROM quarterly_updates WHERE firm_id = ?`, args: [firmId] },
      { sql: `DELETE FROM magic_links WHERE firm_id = ?`, args: [firmId] },
      { sql: `DELETE FROM transactions WHERE firm_id = ?`, args: [firmId] },
    ],
    "write",
  );
}
