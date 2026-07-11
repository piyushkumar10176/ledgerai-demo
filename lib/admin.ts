import { db } from "./db";

// Clear all TRANSACTIONAL data for a firm (journal, bank lines, receipts,
// AI decisions, VAT returns) while keeping firms, users, clients and their
// chart of accounts. Deletes referencing rows before referenced ones so
// foreign-key constraints are never violated.
export async function resetFirmTransactions(firmId: number): Promise<void> {
  const client = await db();
  await client.batch(
    [
      { sql: `DELETE FROM ai_decisions WHERE firm_id = ?`, args: [firmId] },
      { sql: `DELETE FROM bank_transactions WHERE firm_id = ?`, args: [firmId] },
      { sql: `DELETE FROM receipts WHERE firm_id = ?`, args: [firmId] },
      { sql: `DELETE FROM vat_returns WHERE firm_id = ?`, args: [firmId] },
      {
        sql: `DELETE FROM journal_lines WHERE entry_id IN
                (SELECT id FROM journal_entries WHERE firm_id = ?)`,
        args: [firmId],
      },
      { sql: `DELETE FROM journal_entries WHERE firm_id = ?`, args: [firmId] },
    ],
    "write",
  );
}
