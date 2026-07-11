import { getDb } from "./db";

export interface JournalLineInput {
  accountId?: number;
  accountCode?: string; // resolved to accountId within the client
  debit?: number; // pennies
  credit?: number; // pennies
}

export interface PostEntryInput {
  firmId: number;
  clientId: number;
  date: string; // ISO date, e.g. "2026-04-15"
  description: string;
  source: string; // manual | bank_import | receipt | reversal
  lines: JournalLineInput[];
  reversesEntryId?: number;
}

export class LedgerError extends Error {}

function resolveAccountId(
  clientId: number,
  line: JournalLineInput,
): number {
  if (line.accountId) return line.accountId;
  if (!line.accountCode)
    throw new LedgerError("Journal line needs accountId or accountCode");
  const db = getDb();
  const row = db
    .prepare(`SELECT id FROM accounts WHERE client_id = ? AND code = ?`)
    .get(clientId, line.accountCode) as { id: number } | undefined;
  if (!row)
    throw new LedgerError(
      `No account with code ${line.accountCode} for client ${clientId}`,
    );
  return row.id;
}

/**
 * Post a balanced double-entry journal entry. Rejects anything where
 * total debits != total credits. Returns the new entry id.
 * Postings are append-only; there is no update/delete path by design.
 */
export function postEntry(input: PostEntryInput): number {
  if (!input.lines || input.lines.length < 2)
    throw new LedgerError("A journal entry needs at least two lines");

  let totalDebit = 0;
  let totalCredit = 0;
  const resolved = input.lines.map((l) => {
    const debit = Math.round(l.debit ?? 0);
    const credit = Math.round(l.credit ?? 0);
    if (debit < 0 || credit < 0)
      throw new LedgerError("Debit/credit cannot be negative");
    if (debit > 0 && credit > 0)
      throw new LedgerError("A line is either a debit or a credit, not both");
    if (debit === 0 && credit === 0)
      throw new LedgerError("A line must have a non-zero debit or credit");
    totalDebit += debit;
    totalCredit += credit;
    return { accountId: resolveAccountId(input.clientId, l), debit, credit };
  });

  // THE double-entry invariant.
  if (totalDebit !== totalCredit)
    throw new LedgerError(
      `Unbalanced entry: debits ${totalDebit} != credits ${totalCredit}`,
    );
  if (totalDebit === 0)
    throw new LedgerError("Entry total cannot be zero");

  const db = getDb();
  const tx = db.transaction(() => {
    const entry = db
      .prepare(
        `INSERT INTO journal_entries
           (firm_id, client_id, entry_date, description, source, reverses_entry_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.firmId,
        input.clientId,
        input.date,
        input.description,
        input.source,
        input.reversesEntryId ?? null,
      );
    const entryId = Number(entry.lastInsertRowid);
    const lineStmt = db.prepare(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit)
       VALUES (?, ?, ?, ?)`,
    );
    for (const r of resolved)
      lineStmt.run(entryId, r.accountId, r.debit, r.credit);
    return entryId;
  });
  return tx();
}

/**
 * Reverse a posted entry (the ONLY correct way to undo one). Creates a new
 * mirror-image entry so the original stays immutable in the audit trail.
 */
export function reverseEntry(
  firmId: number,
  entryId: number,
  date: string,
): number {
  const db = getDb();
  const orig = db
    .prepare(`SELECT * FROM journal_entries WHERE id = ? AND firm_id = ?`)
    .get(entryId, firmId) as { client_id: number; description: string } | undefined;
  if (!orig) throw new LedgerError(`Entry ${entryId} not found`);
  const lines = db
    .prepare(`SELECT account_id, debit, credit FROM journal_lines WHERE entry_id = ?`)
    .all(entryId) as { account_id: number; debit: number; credit: number }[];

  return postEntry({
    firmId,
    clientId: orig.client_id,
    date,
    description: `Reversal of #${entryId}: ${orig.description}`,
    source: "reversal",
    reversesEntryId: entryId,
    // swap debit <-> credit
    lines: lines.map((l) => ({
      accountId: l.account_id,
      debit: l.credit,
      credit: l.debit,
    })),
  });
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number; // signed: debit-positive
}

// Trial balance for a client. Sum of all balances must be zero if the ledger
// is internally consistent.
export function trialBalance(clientId: number): {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
} {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.code, a.name, a.type,
              COALESCE(SUM(l.debit), 0)  AS debit,
              COALESCE(SUM(l.credit), 0) AS credit
         FROM accounts a
         LEFT JOIN journal_lines l ON l.account_id = a.id
        WHERE a.client_id = ?
        GROUP BY a.id
        HAVING debit <> 0 OR credit <> 0
        ORDER BY a.code`,
    )
    .all(clientId) as { code: string; name: string; type: string; debit: number; credit: number }[];

  let totalDebit = 0;
  let totalCredit = 0;
  const out: TrialBalanceRow[] = rows.map((r) => {
    totalDebit += r.debit;
    totalCredit += r.credit;
    return { ...r, balance: r.debit - r.credit };
  });
  return {
    rows: out,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  };
}
