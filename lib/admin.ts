import { getDb } from "./db";

// Clear all TRANSACTIONAL data for a firm (journal, bank lines, receipts,
// AI decisions, VAT returns) while keeping firms, users, clients and their
// chart of accounts. Handy for re-running the demo from a clean slate.
export function resetFirmTransactions(firmId: number): void {
  const db = getDb();
  const tx = db.transaction(() => {
    // Delete referencing rows BEFORE the rows they point at, so foreign-key
    // constraints (bank_transactions/receipts -> journal_entries,
    // ai_decisions -> receipts) are never violated.
    db.prepare(`DELETE FROM ai_decisions WHERE firm_id = ?`).run(firmId);
    db.prepare(`DELETE FROM bank_transactions WHERE firm_id = ?`).run(firmId);
    db.prepare(`DELETE FROM receipts WHERE firm_id = ?`).run(firmId);
    db.prepare(`DELETE FROM vat_returns WHERE firm_id = ?`).run(firmId);
    db.prepare(
      `DELETE FROM journal_lines WHERE entry_id IN
         (SELECT id FROM journal_entries WHERE firm_id = ?)`,
    ).run(firmId);
    db.prepare(`DELETE FROM journal_entries WHERE firm_id = ?`).run(firmId);
  });
  tx();
}
