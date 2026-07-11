import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureFirmAndClient } from "@/lib/seed";
import { postEntry, trialBalance, LedgerError } from "@/lib/ledger";
import { computeVatReturn } from "@/lib/vat";
import { formatGBP } from "@/lib/money";

// DEV-ONLY self-test proving the double-entry ledger + deterministic VAT engine.
// Uses an isolated "__selftest__" client that it resets on each run.
export async function GET() {
  const { firmId, clientId } = ensureFirmAndClient(
    "__selftest_firm__",
    "__selftest__",
  );
  const db = getDb();

  // Reset this test client's journal (dev-only wipe; real ledger is append-only).
  const entryIds = db
    .prepare(`SELECT id FROM journal_entries WHERE client_id = ?`)
    .all(clientId) as { id: number }[];
  const wipe = db.transaction(() => {
    for (const e of entryIds)
      db.prepare(`DELETE FROM journal_lines WHERE entry_id = ?`).run(e.id);
    db.prepare(`DELETE FROM journal_entries WHERE client_id = ?`).run(clientId);
  });
  wipe();

  const checks: { name: string; pass: boolean; detail: string }[] = [];

  // 1) Balanced SALE: £1,000 net + £200 VAT received into bank.
  postEntry({
    firmId,
    clientId,
    date: "2026-04-10",
    description: "Sale to customer (invoice 001)",
    source: "manual",
    lines: [
      { accountCode: "1200", debit: 120000 }, // Bank
      { accountCode: "4000", credit: 100000 }, // Sales
      { accountCode: "2200", credit: 20000 }, // Output VAT
    ],
  });

  // 2) Balanced PURCHASE: £300 net + £60 VAT of office supplies paid from bank.
  postEntry({
    firmId,
    clientId,
    date: "2026-04-15",
    description: "Office supplies (receipt)",
    source: "manual",
    lines: [
      { accountCode: "6000", debit: 30000 }, // Office Supplies
      { accountCode: "1210", debit: 6000 }, // Input VAT
      { accountCode: "1200", credit: 36000 }, // Bank
    ],
  });
  checks.push({
    name: "Balanced entries post successfully",
    pass: true,
    detail: "Sale + purchase posted",
  });

  // 3) Unbalanced entry MUST be rejected.
  let rejected = false;
  let rejectMsg = "";
  try {
    postEntry({
      firmId,
      clientId,
      date: "2026-04-16",
      description: "Deliberately unbalanced",
      source: "manual",
      lines: [
        { accountCode: "1200", debit: 5000 },
        { accountCode: "4000", credit: 4000 }, // 5000 != 4000
      ],
    });
  } catch (e) {
    rejected = e instanceof LedgerError;
    rejectMsg = (e as Error).message;
  }
  checks.push({
    name: "Unbalanced entry is rejected",
    pass: rejected,
    detail: rejectMsg,
  });

  // 4) Trial balance must balance (total debits == total credits).
  const tb = trialBalance(clientId);
  checks.push({
    name: "Trial balance balances",
    pass: tb.balanced,
    detail: `debits ${formatGBP(tb.totalDebit)} == credits ${formatGBP(tb.totalCredit)}`,
  });

  // 5) Deterministic VAT return for Q1 (Apr-Jun 2026).
  const vat = computeVatReturn(clientId, "2026-04-01", "2026-06-30");
  const expected = {
    box1: 20000, // output VAT
    box3: 20000,
    box4: 6000, // input VAT
    box5: 14000, // net payable = 20000 - 6000
    box6: 100000, // net sales
    box7: 30000, // net purchases
  };
  const vatPass =
    vat.box1 === expected.box1 &&
    vat.box3 === expected.box3 &&
    vat.box4 === expected.box4 &&
    vat.box5 === expected.box5 &&
    vat.box6 === expected.box6 &&
    vat.box7 === expected.box7;
  checks.push({
    name: "VAT 9-box matches expected deterministic figures",
    pass: vatPass,
    detail: `Box5 net VAT payable = ${formatGBP(vat.box5)} (expected ${formatGBP(expected.box5)})`,
  });

  const allPass = checks.every((c) => c.pass);
  return NextResponse.json(
    {
      ok: allPass,
      summary: allPass
        ? "All ledger + VAT self-tests passed."
        : "Some self-tests FAILED.",
      checks,
      trialBalance: {
        balanced: tb.balanced,
        rows: tb.rows.map((r) => ({
          code: r.code,
          name: r.name,
          debit: formatGBP(r.debit),
          credit: formatGBP(r.credit),
        })),
      },
      vatReturn: Object.fromEntries(
        Object.entries(vat).map(([k, v]) => [k, formatGBP(v as number)]),
      ),
    },
    { status: allPass ? 200 : 500 },
  );
}
