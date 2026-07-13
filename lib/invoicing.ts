import { many, one, run } from "./db";

export interface Invoice {
  id: number;
  client_id: number;
  client_name: string;
  number: string;
  amount: number;
  issued_date: string | null;
  due_date: string | null;
  status: string;
}

export function listInvoices(firmId: number, filter = "all"): Promise<Invoice[]> {
  const where = filter === "all" ? "" : " AND i.status = @f";
  return many<Invoice>(
    `SELECT i.id, i.client_id, c.name AS client_name, i.number, i.amount, i.issued_date, i.due_date, i.status
       FROM invoices i JOIN clients c ON c.id = i.client_id
      WHERE i.firm_id = @firm${where}
      ORDER BY i.id DESC`,
    filter === "all" ? { firm: firmId } : { firm: firmId, f: filter },
  );
}

export async function invoiceStats(firmId: number): Promise<{ outstanding: number; overdue: number; paid: number; outCount: number; overCount: number }> {
  const rows = await many<{ status: string; total: number; n: number }>(
    `SELECT status, COALESCE(SUM(amount),0) AS total, COUNT(*) AS n FROM invoices WHERE firm_id = ? GROUP BY status`,
    [firmId],
  );
  const by = (s: string) => rows.find((r) => r.status === s) ?? { total: 0, n: 0 };
  const sent = by("sent"), overdue = by("overdue"), paid = by("paid");
  return {
    outstanding: sent.total + overdue.total,
    overdue: overdue.total,
    paid: paid.total,
    outCount: sent.n + overdue.n,
    overCount: overdue.n,
  };
}

export async function createInvoice(firmId: number, clientId: number, amount: number): Promise<number> {
  const last = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM invoices WHERE firm_id = ?`, [firmId]);
  const number = "INV-" + (2050 + (last?.n ?? 0) + 1);
  const r = await run(
    `INSERT INTO invoices (firm_id, client_id, number, amount, status) VALUES (?, ?, ?, ?, 'draft')`,
    [firmId, clientId, number, Math.round(amount)],
  );
  return r.lastId;
}

export async function setInvoiceStatus(firmId: number, id: number, status: string): Promise<void> {
  await run(`UPDATE invoices SET status = ? WHERE id = ? AND firm_id = ?`, [status, id, firmId]);
}
