import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { listInvoices, invoiceStats } from "@/lib/invoicing";
import { formatGBP } from "@/lib/money";
import { NewInvoice, MarkPaid } from "@/components/InvoiceActions";

const PILL: Record<string, { color: string; background: string }> = {
  paid: { color: "#12805c", background: "#e6f9f0" },
  overdue: { color: "#b42318", background: "#fee4e2" },
  sent: { color: "#5546d4", background: "#eef0ff" },
  draft: { color: "#6b6a76", background: "#f0eff5" },
};

export default async function InvoicingPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const filter = (await searchParams).f ?? "all";
  const [stats, invoices, clients] = await Promise.all([
    invoiceStats(session.firmId), listInvoices(session.firmId, filter), listClients(session.firmId),
  ]);

  const tabs = [["all", "All"], ["overdue", "Overdue"], ["sent", "Sent"], ["paid", "Paid"]];

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>Invoicing</h1>
        <p className="text-[13px] text-[#8a879a]">Across all managed clients</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatGBP(stats.outstanding)} sub={`${stats.outCount} invoices`} color="#16151c" />
        <Stat label="Overdue" value={formatGBP(stats.overdue)} sub={`${stats.overCount} invoices · AI chasers ready`} color="#f04438" />
        <Stat label="Paid this month" value={formatGBP(stats.paid)} sub="settled" color="#16b364" />
      </div>

      <div className="mt-4 card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-[#efeff5] px-5 py-3">
          <div className="flex gap-1 rounded-[10px] bg-[#f5f5fa] p-1">
            {tabs.map(([id, label]) => (
              <Link key={id} href={`/invoicing?f=${id}`} className="rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition"
                style={filter === id ? { background: "#fff", color: "#16151c", boxShadow: "0 1px 3px rgba(0,0,0,.1)" } : { color: "#8a879a" }}>{label}</Link>
            ))}
          </div>
          <div className="flex-1" />
          <NewInvoice clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
        <div className="scroll-x">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[#efeff5] bg-[#fafafd] text-left text-[11px] font-bold uppercase tracking-[.04em] text-[#9995ab]">
                <th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Client</th>
                <th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Due</th><th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((iv) => (
                <tr key={iv.id} className="border-b border-[#f4f4f9]">
                  <td className="mono px-5 py-3.5 text-[12.5px] font-semibold">{iv.number}</td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold text-[#3a3850]">{iv.client_name}</td>
                  <td className="mono px-5 py-3.5 text-right text-[13px] font-semibold">{formatGBP(iv.amount)}</td>
                  <td className="px-5 py-3.5 text-[12.5px] font-semibold" style={{ color: iv.status === "overdue" ? "#f04438" : iv.status === "paid" ? "#12805c" : "#6b6a76" }}>{iv.due_date ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {iv.status !== "paid" && iv.status !== "draft" && <MarkPaid id={iv.id} />}
                      <span className="chip" style={PILL[iv.status]}>{iv.status[0].toUpperCase() + iv.status.slice(1)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#a6a3b6]">No invoices in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card p-[18px]">
      <div className="text-[12.5px] font-semibold text-[#8a879a]">{label}</div>
      <div className="mono mt-2 text-[24px] font-extrabold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[11.5px] font-medium text-[#a6a3b6]">{sub}</div>
    </div>
  );
}
