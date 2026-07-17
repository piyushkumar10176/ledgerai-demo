import { one, many, run } from "./db";
import { addTransaction } from "./transactions";
import { submitQuarterlyUpdate } from "./quarterly-submit";
import { setClientServices } from "./services";
import type { SourceType } from "./hmrc-categories";

// Sample ITSA clients for the demo, each with an income source, categorised
// transactions for 2026/27 Q1, and (for some) a submitted quarterly update.
// Idempotent: a client is only populated once.

interface TxnSpec { date: string; desc: string; signed: number } // signed pennies
interface LookBackSpec { year: number; type: string; gross: number } // pennies, GROSS
interface SampleClient {
  name: string;
  nino: string;
  utr: string;
  phone: string;
  mandation: { status: string; wave: string | null }; // placeholder — the REAL
  // engine (runMandationCheck) overwrites these from lookBack income at seed time
  agentAuth: string;
  source: { type: SourceType; businessName: string; turnover: number };
  lookBack: LookBackSpec[];
  txns: TxnSpec[];
  submitQ1: boolean;
  services: string[];
  vrn?: string;
  mtdItId?: string;
}

const SAMPLES: SampleClient[] = [
  {
    name: "Priya Shah",
    nino: "QQ123456C", utr: "1234567890", phone: "07700 900111",
    mandation: { status: "mandated", wave: "2026" }, agentAuth: "linked",
    source: { type: "self-employment", businessName: "Priya's Catering", turnover: 6_000_000 },
    lookBack: [{ year: 2024, type: "self-employment", gross: 6_000_000 }],
    txns: [
      { date: "2026-04-15", desc: "Sumup takings settlement", signed: 320000 },
      { date: "2026-05-20", desc: "Sumup takings settlement", signed: 280000 },
      { date: "2026-06-10", desc: "Event catering invoice", signed: 150000 },
      { date: "2026-04-22", desc: "Flour Power wholesale", signed: -90000 },
      { date: "2026-05-06", desc: "Shell fuel", signed: -18000 },
      { date: "2026-05-28", desc: "British Gas premises", signed: -24000 },
      { date: "2026-06-14", desc: "The Corner Bistro", signed: -8400 }, // low conf -> review
    ],
    submitQ1: true,
    services: ["bookkeeping", "vat", "mtd-itsa"],
  },
  {
    name: "Tom Fletcher",
    nino: "QQ234567B", utr: "2345678901", phone: "07700 900222",
    mandation: { status: "mandated", wave: "2026" }, agentAuth: "linked",
    source: { type: "self-employment", businessName: "Fletcher Plumbing", turnover: 12_000_000 },
    lookBack: [{ year: 2024, type: "self-employment", gross: 12_000_000 }],
    txns: [
      { date: "2026-04-20", desc: "Card settlement", signed: 840000 },
      { date: "2026-05-15", desc: "Invoice - bathroom job", signed: 620000 },
      { date: "2026-04-25", desc: "Wickes materials", signed: -240000 },
      { date: "2026-05-02", desc: "Subcontractor labour", signed: -180000 },
      { date: "2026-05-19", desc: "Diesel BP", signed: -32000 },
      { date: "2026-06-08", desc: "Premier Stores", signed: -4800 }, // low conf -> review
    ],
    submitQ1: false, // stays "ready to file" (amber)
    services: ["bookkeeping", "mtd-itsa", "payroll"],
  },
  {
    name: "Aisha Khan",
    nino: "QQ345678A", utr: "3456789012", phone: "07700 900333",
    mandation: { status: "mandated", wave: "2027" }, agentAuth: "pending",
    source: { type: "uk-property", businessName: "Khan Property Lettings", turnover: 3_000_000 },
    lookBack: [{ year: 2024, type: "uk-property", gross: 2_800_000 }, { year: 2025, type: "uk-property", gross: 3_100_000 }],
    txns: [
      { date: "2026-04-05", desc: "Rent received - flat 1", signed: 360000 },
      { date: "2026-05-05", desc: "Rent received - flat 2", signed: 240000 },
      { date: "2026-05-12", desc: "Boiler repair", signed: -48000 },
      { date: "2026-06-01", desc: "Managing agent professional fee", signed: -60000 },
    ],
    submitQ1: true,
    services: ["mtd-itsa"],
  },
  {
    name: "Sam Rivers",
    nino: "QQ456789D", utr: "4567890123", phone: "07700 900444",
    mandation: { status: "mandated", wave: "2026" }, agentAuth: "missing",
    source: { type: "self-employment", businessName: "Rivers Design", turnover: 5_500_000 },
    lookBack: [{ year: 2024, type: "self-employment", gross: 5_500_000 }],
    txns: [], // no data -> "missing" (red); the hands-on client
    submitQ1: false,
    services: ["bookkeeping", "mtd-itsa"],
  },
  {
    // Real HMRC SANDBOX test user — VRN/NINO/UTR/MTD-IT-ID are live sandbox IDs.
    name: "Fay Ingham",
    nino: "BY918335C", utr: "6334720476", phone: "07700 900555",
    mandation: { status: "mandated", wave: "2026" }, agentAuth: "linked",
    vrn: "466677396", mtdItId: "XTIT00002270770",
    source: { type: "self-employment", businessName: "Ingham Trading", turnover: 8_000_000 },
    lookBack: [{ year: 2024, type: "self-employment", gross: 8_000_000 }],
    txns: [
      { date: "2026-04-18", desc: "Card settlement", signed: 420000 },
      { date: "2026-05-22", desc: "Invoice - consultancy", signed: 360000 },
      { date: "2026-04-24", desc: "Wickes materials", signed: -96000 },
      { date: "2026-05-09", desc: "Shell fuel", signed: -18000 },
      { date: "2026-06-02", desc: "Accountant fee", signed: -36000 },
      { date: "2026-06-16", desc: "Premier Stores", signed: -3600 }, // low conf -> review
    ],
    submitQ1: false, // ready to file
    services: ["bookkeeping", "vat", "mtd-itsa"],
  },
];

export async function seedSampleData(firmId: number): Promise<void> {
  for (const spec of SAMPLES) {
    let client = await one<{ id: number }>(
      `SELECT id FROM clients WHERE firm_id = ? AND name = ?`,
      [firmId, spec.name],
    );
    let clientId: number;
    if (!client) {
      const r = await run(
        `INSERT INTO clients (firm_id, name, nino, utr, phone, mandation_status, mandation_wave, agent_auth_status, vrn, mtd_it_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [firmId, spec.name, spec.nino, spec.utr, spec.phone, spec.mandation.status, spec.mandation.wave, spec.agentAuth, spec.vrn ?? null, spec.mtdItId ?? null],
      );
      clientId = r.lastId;
    } else {
      clientId = client.id;
    }
    await setClientServices(clientId, spec.services);

    let source = await one<{ id: number }>(
      `SELECT id FROM income_sources WHERE client_id = ?`,
      [clientId],
    );
    let sourceId: number;
    if (!source) {
      const r = await run(
        `INSERT INTO income_sources (firm_id, client_id, type, business_name, hmrc_business_id, accounting_method, annual_turnover)
         VALUES (?, ?, ?, ?, ?, 'cash', ?)`,
        [firmId, clientId, spec.source.type, spec.source.businessName, "XBIS" + (100000 + clientId), spec.source.turnover],
      );
      sourceId = r.lastId;
    } else {
      sourceId = source.id;
    }

    // Look-back-year gross income — the REAL mandation engine's inputs.
    const lbCount = await one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM source_year_income WHERE client_id = ?`,
      [clientId],
    );
    if ((lbCount?.n ?? 0) === 0)
      for (const lb of spec.lookBack)
        await run(
          `INSERT INTO source_year_income
             (firm_id, client_id, tax_year_start, type, description, gross_income)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [firmId, clientId, lb.year, lb.type, spec.source.businessName, lb.gross],
        );

    // Only populate transactions once.
    const count = await one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM transactions WHERE income_source_id = ?`,
      [sourceId],
    );
    if ((count?.n ?? 0) > 0) continue;

    for (const t of spec.txns)
      await addTransaction(firmId, clientId, sourceId, spec.source.type, {
        date: t.date,
        description: t.desc,
        signedAmount: t.signed,
        source: "bank",
        provenance: "sample data",
      });

    if (spec.submitQ1 && spec.txns.length > 0)
      await submitQuarterlyUpdate(firmId, clientId, sourceId, "2026Q1");
  }

  // Statuses/waves come from the REAL engine, never the placeholder literals —
  // the seed narrative must obey the same law as everything else.
  const { runMandationCheck } = await import("./mandation");
  await runMandationCheck(firmId);

  // Seed sample invoices once.
  const invCount = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM invoices WHERE firm_id = ?`, [firmId]);
  if ((invCount?.n ?? 0) === 0) {
    const cl = await many<{ id: number; name: string }>(`SELECT id, name FROM clients WHERE firm_id = ? ORDER BY id`, [firmId]);
    const pick = (i: number) => cl[i % cl.length]?.id;
    const INV: [string, number, number, string, string][] = [
      ["INV-2048", 0, 640000, "in 12 days", "sent"],
      ["INV-2047", 1, 215000, "Paid 8 Jul", "paid"],
      ["INV-2044", 2, 380000, "in 4 days", "sent"],
      ["INV-2041", 3, 420000, "21 days ago", "overdue"],
      ["INV-2039", 0, 195000, "6 days ago", "overdue"],
      ["INV-2038", 1, 560000, "Paid 2 Jul", "paid"],
      ["INV-2051", 2, 98000, "Draft", "draft"],
    ];
    for (const [num, ci, amt, due, status] of INV) {
      const clid = pick(ci);
      if (clid) await run(
        `INSERT INTO invoices (firm_id, client_id, number, amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [firmId, clid, num, amt, due, status],
      );
    }
  }
}
