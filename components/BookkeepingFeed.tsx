"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: number; client_name: string; business_name: string; txn_date: string;
  description: string; direction: string; category: string | null; categoryLabel: string;
  amount: number; status: string; confidence: number | null; dup?: boolean;
}

function gbp(p: number, dir: string) {
  const s = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(p / 100);
  return (dir === "income" ? "+" : "−") + s;
}
function shortDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function BookkeepingFeed({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function approve(id: number) {
    setBusy(id);
    await fetch(`/api/transactions/${id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(null); router.refresh();
  }

  function catChip(r: Row) {
    if (r.status === "review") return { bg: "#fef0c7", fg: "#b54708", dot: "#f79009" };
    if (r.direction === "income") return { bg: "#e6f9f0", fg: "#12805c", dot: "#16b364" };
    return { bg: "#eef0ff", fg: "#5546d4", dot: "#7c6cf5" };
  }

  return (
    <div className="scroll-x">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="border-b border-[#efeff5] bg-[#fafafd] text-left text-[11px] font-bold uppercase tracking-[.04em] text-[#9995ab]">
            <th className="px-5 py-3">Date</th><th className="px-5 py-3">Description</th>
            <th className="px-5 py-3">Category</th><th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = catChip(r);
            const approved = r.status === "auto" || r.status === "confirmed" || r.status === "manual";
            return (
              <tr key={r.id} className="border-b border-[#f4f4f9]">
                <td className="mono px-5 py-3 text-[11.5px] text-[#9995ab]">{shortDate(r.txn_date)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#16151c]">{r.description}</span>
                    {r.dup && <span className="chip" style={{ background: "#fef0c7", color: "#b54708" }}>⚠ duplicate</span>}
                  </div>
                  <div className="text-[11px] text-[#a6a3b6]">{r.client_name} · {r.business_name}</div>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold" style={{ background: c.bg, color: c.fg }}>
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: c.dot }} />{r.categoryLabel}
                  </span>
                </td>
                <td className="mono px-5 py-3 text-right text-[13px] font-semibold" style={{ color: r.direction === "income" ? "#12805c" : "#16151c" }}>{gbp(r.amount, r.direction)}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end">
                    {approved ? (
                      <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#12805c]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12805c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Approved
                      </span>
                    ) : (
                      <button onClick={() => approve(r.id)} disabled={busy === r.id} className="rounded-lg border border-[#d9d7e8] bg-white px-3 py-1.5 text-[11.5px] font-bold text-brand-600 hover:bg-[#faf9ff] disabled:opacity-50">
                        {busy === r.id ? "…" : "Approve"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#a6a3b6]">No transactions yet — import a bank statement on a client.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
