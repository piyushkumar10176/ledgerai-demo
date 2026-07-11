import { getDb } from "./db";
import { seedChartOfAccounts } from "./coa";
import { postEntry } from "./ledger";
import { splitGross } from "./money";
import { processReceipt } from "./receipts";
import { submitVatReturn } from "./vat-submit";

// ============================================================================
// SAMPLE DATA for review/demo. Creates a few extra clients, each pre-populated
// with a realistic ledger, receipts (incl. a review-queue item) and a submitted
// VAT return, so anyone opening the app sees a populated product. Idempotent:
// clients are only created once, and a client is only populated if it has no
// journal entries yet (so it survives the "Reset demo data" button).
// ============================================================================

interface Sale {
  date: string;
  desc: string;
  gross: number; // pennies
}
interface Purchase {
  date: string;
  desc: string;
  code: string;
  gross: number; // pennies
  vat: "standard" | "none";
}
interface SampleClient {
  name: string;
  companyNumber: string;
  vatNumber: string;
  sales: Sale[];
  purchases: Purchase[];
  receipts: string[]; // ocr-mock scenario keys
  vatPeriod: { start: string; end: string };
}

const SAMPLES: SampleClient[] = [
  {
    name: "Green Thumb Landscaping Ltd",
    companyNumber: "11223344",
    vatNumber: "GB222333444",
    sales: [
      { date: "2026-04-05", desc: "Garden design — Oakwood", gross: 240000 },
      { date: "2026-04-20", desc: "Maintenance contract", gross: 180000 },
      { date: "2026-05-10", desc: "Patio installation", gross: 360000 },
    ],
    purchases: [
      { date: "2026-04-08", desc: "Plants & materials", code: "5000", gross: 96000, vat: "standard" },
      { date: "2026-04-12", desc: "Van fuel", code: "6200", gross: 12000, vat: "standard" },
      { date: "2026-05-01", desc: "Yard rent", code: "6100", gross: 60000, vat: "none" },
    ],
    receipts: ["fuel", "misc"], // misc = low confidence -> review queue
    vatPeriod: { start: "2026-04-01", end: "2026-06-30" },
  },
  {
    name: "Willow Lane Boutique",
    companyNumber: "22334455",
    vatNumber: "GB333444555",
    sales: [
      { date: "2026-04-03", desc: "Card takings week 1", gross: 312000 },
      { date: "2026-04-17", desc: "Card takings week 3", gross: 288000 },
      { date: "2026-05-08", desc: "Card takings week 6", gross: 336000 },
    ],
    purchases: [
      { date: "2026-04-06", desc: "Stock — spring range", code: "5000", gross: 180000, vat: "standard" },
      { date: "2026-04-22", desc: "Shopfront utilities", code: "6400", gross: 21600, vat: "standard" },
      { date: "2026-05-02", desc: "Store rent", code: "6100", gross: 150000, vat: "none" },
    ],
    receipts: ["office"], // high confidence -> auto-post
    vatPeriod: { start: "2026-04-01", end: "2026-06-30" },
  },
  {
    name: "Cloudpeak Consulting Ltd",
    companyNumber: "33445566",
    vatNumber: "GB444555666",
    sales: [
      { date: "2026-04-14", desc: "Advisory retainer — Q1", gross: 420000 },
    ],
    purchases: [
      { date: "2026-04-09", desc: "Cloud hosting", code: "6400", gross: 72000, vat: "standard" },
      { date: "2026-04-18", desc: "Subcontractor — design", code: "6300", gross: 180000, vat: "standard" },
      { date: "2026-05-05", desc: "Office rent", code: "6100", gross: 90000, vat: "none" },
    ],
    receipts: ["cafe"], // low confidence -> review queue
    vatPeriod: { start: "2026-04-01", end: "2026-06-30" },
  },
];

function postSale(firmId: number, clientId: number, s: Sale) {
  const { net, vat } = splitGross(s.gross);
  postEntry({
    firmId,
    clientId,
    date: s.date,
    description: s.desc,
    source: "manual",
    lines: [
      { accountCode: "1200", debit: s.gross },
      { accountCode: "4000", credit: net },
      { accountCode: "2200", credit: vat },
    ],
  });
}

function postPurchase(firmId: number, clientId: number, p: Purchase) {
  const split = p.vat === "standard" ? splitGross(p.gross) : { net: p.gross, vat: 0 };
  postEntry({
    firmId,
    clientId,
    date: p.date,
    description: p.desc,
    source: "bank_import",
    lines: [
      { accountCode: p.code, debit: split.net },
      ...(split.vat > 0 ? [{ accountCode: "1210", debit: split.vat }] : []),
      { accountCode: "1200", credit: p.gross },
    ],
  });
}

// Create the sample clients (idempotent) and populate any that are empty.
export function seedSampleData(firmId: number): void {
  const db = getDb();
  for (const spec of SAMPLES) {
    let client = db
      .prepare(`SELECT id FROM clients WHERE firm_id = ? AND name = ?`)
      .get(firmId, spec.name) as { id: number } | undefined;
    if (!client) {
      const r = db
        .prepare(
          `INSERT INTO clients (firm_id, name, company_number, vat_number)
           VALUES (?, ?, ?, ?)`,
        )
        .run(firmId, spec.name, spec.companyNumber, spec.vatNumber);
      client = { id: Number(r.lastInsertRowid) };
      seedChartOfAccounts(firmId, client.id);
    }

    // Only populate if this client has no postings yet.
    const count = db
      .prepare(`SELECT COUNT(*) AS n FROM journal_entries WHERE client_id = ?`)
      .get(client.id) as { n: number };
    if (count.n > 0) continue;

    for (const s of spec.sales) postSale(firmId, client.id, s);
    for (const p of spec.purchases) postPurchase(firmId, client.id, p);
    spec.receipts.forEach((scenario, i) =>
      processReceipt(firmId, client!.id, `sample-${scenario}-${i}.jpg`, scenario),
    );
    submitVatReturn(firmId, client.id, spec.vatPeriod.start, spec.vatPeriod.end);
  }
}
