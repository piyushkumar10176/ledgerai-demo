import { many, run, db } from "./db";

export type ServiceKey = "bookkeeping" | "vat" | "mtd-itsa" | "payroll";

export interface ServiceDef {
  key: ServiceKey;
  label: string;
  short: string;
  desc: string;
  accent: string; // tailwind text/border accent
  chip: string; // tailwind chip bg+text
  dot: string; // tailwind dot bg
  emoji: string;
  href: string; // sub-route under /clients/[id]
}

export const SERVICES: ServiceDef[] = [
  {
    key: "bookkeeping", label: "Bookkeeping", short: "Books",
    desc: "Chart of accounts, categorised transactions, P&L.",
    accent: "text-sky-700", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500",
    emoji: "📚", href: "bookkeeping",
  },
  {
    key: "vat", label: "VAT", short: "VAT",
    desc: "MTD VAT 9-box return and obligations.",
    accent: "text-violet-700", chip: "bg-violet-100 text-violet-700", dot: "bg-violet-500",
    emoji: "🧾", href: "vat",
  },
  {
    key: "mtd-itsa", label: "MTD Income Tax", short: "MTD IT",
    desc: "Quarterly cumulative updates per income source.",
    accent: "text-indigo-700", chip: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500",
    emoji: "📈", href: "mtd",
  },
  {
    key: "payroll", label: "Payroll", short: "Payroll",
    desc: "PAYE / RTI — integration (not built).",
    accent: "text-amber-700", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500",
    emoji: "💷", href: "payroll",
  },
];

export function serviceDef(key: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.key === key);
}

export async function getClientServices(clientId: number): Promise<ServiceKey[]> {
  const rows = await many<{ service: string }>(
    `SELECT service FROM client_services WHERE client_id = ? ORDER BY service`,
    [clientId],
  );
  const order = SERVICES.map((s) => s.key);
  return rows
    .map((r) => r.service as ServiceKey)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export async function setClientServices(
  clientId: number,
  services: string[],
): Promise<void> {
  const valid = services.filter((s) => SERVICES.some((d) => d.key === s));
  const client = await db();
  await client.batch(
    [
      { sql: `DELETE FROM client_services WHERE client_id = ?`, args: [clientId] },
      ...valid.map((s) => ({
        sql: `INSERT INTO client_services (client_id, service) VALUES (?, ?)`,
        args: [clientId, s] as (string | number)[],
      })),
    ],
    "write",
  );
}

// Count of clients per service, for the dashboard tiles.
export async function serviceCounts(
  firmId: number,
): Promise<Record<string, number>> {
  const rows = await many<{ service: string; n: number }>(
    `SELECT cs.service, COUNT(*) AS n
       FROM client_services cs JOIN clients c ON c.id = cs.client_id
      WHERE c.firm_id = ?
      GROUP BY cs.service`,
    [firmId],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.service] = r.n;
  return out;
}
