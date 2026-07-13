import { one, run } from "./db";
import { addTransaction } from "./transactions";
import { submitQuarterlyUpdate } from "./quarterly-submit";
import type { SourceType } from "./hmrc-categories";

// Sample ITSA clients for the demo, each with an income source, categorised
// transactions for 2026/27 Q1, and (for some) a submitted quarterly update.
// Idempotent: a client is only populated once.

interface TxnSpec { date: string; desc: string; signed: number } // signed pennies
interface SampleClient {
  name: string;
  nino: string;
  utr: string;
  phone: string;
  mandation: { status: string; wave: string | null };
  agentAuth: string;
  source: { type: SourceType; businessName: string; turnover: number };
  txns: TxnSpec[];
  submitQ1: boolean;
}

const SAMPLES: SampleClient[] = [
  {
    name: "Priya Shah",
    nino: "QQ123456C", utr: "1234567890", phone: "07700 900111",
    mandation: { status: "mandated", wave: "2026" }, agentAuth: "linked",
    source: { type: "self-employment", businessName: "Priya's Catering", turnover: 6_000_000 },
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
  },
  {
    name: "Tom Fletcher",
    nino: "QQ234567B", utr: "2345678901", phone: "07700 900222",
    mandation: { status: "mandated", wave: "2026" }, agentAuth: "linked",
    source: { type: "self-employment", businessName: "Fletcher Plumbing", turnover: 12_000_000 },
    txns: [
      { date: "2026-04-20", desc: "Card settlement", signed: 840000 },
      { date: "2026-05-15", desc: "Invoice - bathroom job", signed: 620000 },
      { date: "2026-04-25", desc: "Wickes materials", signed: -240000 },
      { date: "2026-05-02", desc: "Subcontractor labour", signed: -180000 },
      { date: "2026-05-19", desc: "Diesel BP", signed: -32000 },
      { date: "2026-06-08", desc: "Premier Stores", signed: -4800 }, // low conf -> review
    ],
    submitQ1: false, // stays "ready to file" (amber)
  },
  {
    name: "Aisha Khan",
    nino: "QQ345678A", utr: "3456789012", phone: "07700 900333",
    mandation: { status: "mandated", wave: "2027" }, agentAuth: "pending",
    source: { type: "uk-property", businessName: "Khan Property Lettings", turnover: 3_000_000 },
    txns: [
      { date: "2026-04-05", desc: "Rent received - flat 1", signed: 360000 },
      { date: "2026-05-05", desc: "Rent received - flat 2", signed: 240000 },
      { date: "2026-05-12", desc: "Boiler repair", signed: -48000 },
      { date: "2026-06-01", desc: "Managing agent professional fee", signed: -60000 },
    ],
    submitQ1: true,
  },
  {
    name: "Sam Rivers",
    nino: "QQ456789D", utr: "4567890123", phone: "07700 900444",
    mandation: { status: "mandated", wave: "2026" }, agentAuth: "missing",
    source: { type: "self-employment", businessName: "Rivers Design", turnover: 5_500_000 },
    txns: [], // no data -> "missing" (red); the hands-on client
    submitQ1: false,
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
        `INSERT INTO clients (firm_id, name, nino, utr, phone, mandation_status, mandation_wave, agent_auth_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [firmId, spec.name, spec.nino, spec.utr, spec.phone, spec.mandation.status, spec.mandation.wave, spec.agentAuth],
      );
      clientId = r.lastId;
    } else {
      clientId = client.id;
    }

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
}
