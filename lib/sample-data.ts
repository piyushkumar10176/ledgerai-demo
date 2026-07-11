import { one, run } from "./db";
import { seedChartOfAccounts } from "./coa";
import { postEntry } from "./ledger";
import { splitGross } from "./money";
import { processReceipt } from "./receipts";
import { submitVatReturn } from "./vat-submit";

// Sample data for review/demo: a few extra clients each pre-populated with a
// ledger, receipts (incl. a review-queue item) and a submitted VAT return.
// Idempotent: clients created once; a client is only populated if it has no
// journal entries yet (survives the "Reset demo data" button).

interface Sale {
  date: string;
  desc: string;
  gross: number;
}
interface Purchase {
  date: string;
  desc: string;
  code: string;
  gross: number;
  vat: "standard" | "none";
}
interface SampleClient {
  name: string;
  companyNumber: string;
  vatNumber: string;
  sales: Sale[];
  purchases: Purchase[];
  receipts: string[];
  vatPeriod: { start: string; end: string };
  submitVat?: boolean; // false => stays "ready to file" (amber) in the control tower
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
    receipts: ["fuel", "misc"],
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
    receipts: ["office"],
    vatPeriod: { start: "2026-04-01", end: "2026-06-30" },
  },
  {
    name: "Cloudpeak Consulting Ltd",
    companyNumber: "33445566",
    vatNumber: "GB444555666",
    sales: [{ date: "2026-04-14", desc: "Advisory retainer — Q1", gross: 420000 }],
    purchases: [
      { date: "2026-04-09", desc: "Cloud hosting", code: "6400", gross: 72000, vat: "standard" },
      { date: "2026-04-18", desc: "Subcontractor — design", code: "6300", gross: 180000, vat: "standard" },
      { date: "2026-05-05", desc: "Office rent", code: "6100", gross: 90000, vat: "none" },
    ],
    receipts: ["cafe"],
    vatPeriod: { start: "2026-04-01", end: "2026-06-30" },
    submitVat: false, // leave unfiled -> shows as "ready to file" in the control tower
  },
];

function postSale(firmId: number, clientId: number, s: Sale): Promise<number> {
  const { net, vat } = splitGross(s.gross);
  return postEntry({
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

function postPurchase(
  firmId: number,
  clientId: number,
  p: Purchase,
): Promise<number> {
  const split = p.vat === "standard" ? splitGross(p.gross) : { net: p.gross, vat: 0 };
  return postEntry({
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

export async function seedSampleData(firmId: number): Promise<void> {
  for (const spec of SAMPLES) {
    let client = await one<{ id: number }>(
      `SELECT id FROM clients WHERE firm_id = ? AND name = ?`,
      [firmId, spec.name],
    );
    if (!client) {
      const r = await run(
        `INSERT INTO clients (firm_id, name, company_number, vat_number)
         VALUES (?, ?, ?, ?)`,
        [firmId, spec.name, spec.companyNumber, spec.vatNumber],
      );
      client = { id: r.lastId };
      await seedChartOfAccounts(firmId, client.id);
    }

    const count = await one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM journal_entries WHERE client_id = ?`,
      [client.id],
    );
    if ((count?.n ?? 0) > 0) continue; // already populated

    for (const s of spec.sales) await postSale(firmId, client.id, s);
    for (const p of spec.purchases) await postPurchase(firmId, client.id, p);
    for (let i = 0; i < spec.receipts.length; i++)
      await processReceipt(
        firmId,
        client.id,
        `sample-${spec.receipts[i]}-${i}.jpg`,
        spec.receipts[i],
      );
    if (spec.submitVat !== false)
      await submitVatReturn(firmId, client.id, spec.vatPeriod.start, spec.vatPeriod.end);
  }
}
