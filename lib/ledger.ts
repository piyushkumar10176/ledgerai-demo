import { db, one, many } from "./db";

export interface JournalLineInput {
  accountId?: number;
  accountCode?: string;
  debit?: number; // pennies
  credit?: number; // pennies
}

export interface PostEntryInput {
  firmId: number;
  clientId: number;
  date: string;
  description: string;
  source: string;
  lines: JournalLineInput[];
  reversesEntryId?: number;
}

export class LedgerError extends Error {}

async function resolveAccountId(
  clientId: number,
  line: JournalLineInput,
): Promise<number> {
  if (line.accountId) return line.accountId;
  if (!line.accountCode)
    throw new LedgerError("Journal line needs accountId or accountCode");
  const row = await one<{ id: number }>(
    `SELECT id FROM accounts WHERE client_id = ? AND code = ?`,
    [clientId, line.accountCode],
  );
  if (!row)
    throw new LedgerError(
      `No account with code ${line.accountCode} for client ${clientId}`,
    );
  return row.id;
}

/**
 * Post a balanced double-entry journal entry. Rejects anything where
 * total debits != total credits. Returns the new entry id. Append-only.
 */
export async function postEntry(input: PostEntryInput): Promise<number> {
  if (!input.lines || input.lines.length < 2)
    throw new LedgerError("A journal entry needs at least two lines");

  let totalDebit = 0;
  let totalCredit = 0;
  const resolved: { accountId: number; debit: number; credit: number }[] = [];
  for (const l of input.lines) {
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
    resolved.push({
      accountId: await resolveAccountId(input.clientId, l),
      debit,
      credit,
    });
  }

  // THE double-entry invariant.
  if (totalDebit !== totalCredit)
    throw new LedgerError(
      `Unbalanced entry: debits ${totalDebit} != credits ${totalCredit}`,
    );
  if (totalDebit === 0) throw new LedgerError("Entry total cannot be zero");

  const client = await db();
  const tx = await client.transaction("write");
  try {
    const entry = await tx.execute({
      sql: `INSERT INTO journal_entries
              (firm_id, client_id, entry_date, description, source, reverses_entry_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        input.firmId,
        input.clientId,
        input.date,
        input.description,
        input.source,
        input.reversesEntryId ?? null,
      ],
    });
    const entryId = Number(entry.lastInsertRowid);
    for (const r of resolved)
      await tx.execute({
        sql: `INSERT INTO journal_lines (entry_id, account_id, debit, credit)
              VALUES (?, ?, ?, ?)`,
        args: [entryId, r.accountId, r.debit, r.credit],
      });
    await tx.commit();
    return entryId;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

/**
 * Reverse a posted entry (the ONLY correct way to undo one). Creates a
 * mirror-image entry so the original stays immutable in the audit trail.
 */
export async function reverseEntry(
  firmId: number,
  entryId: number,
  date: string,
): Promise<number> {
  const orig = await one<{ client_id: number; description: string }>(
    `SELECT client_id, description FROM journal_entries WHERE id = ? AND firm_id = ?`,
    [entryId, firmId],
  );
  if (!orig) throw new LedgerError(`Entry ${entryId} not found`);
  const lines = await many<{ account_id: number; debit: number; credit: number }>(
    `SELECT account_id, debit, credit FROM journal_lines WHERE entry_id = ?`,
    [entryId],
  );

  return postEntry({
    firmId,
    clientId: orig.client_id,
    date,
    description: `Reversal of #${entryId}: ${orig.description}`,
    source: "reversal",
    reversesEntryId: entryId,
    lines: lines.map((l) => ({
      accountId: l.account_id,
      debit: l.credit, // swap
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
  balance: number;
}

export async function trialBalance(clientId: number): Promise<{
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}> {
  const rows = await many<{
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
  }>(
    `SELECT a.code, a.name, a.type,
            COALESCE(SUM(l.debit), 0)  AS debit,
            COALESCE(SUM(l.credit), 0) AS credit
       FROM accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id
      WHERE a.client_id = ?
      GROUP BY a.id
      HAVING debit <> 0 OR credit <> 0
      ORDER BY a.code`,
    [clientId],
  );

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
