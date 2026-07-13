"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cat { code: string; label: string; direction: string }
interface Txn {
  id: number; txn_date: string; description: string; direction: string;
  category: string | null; amount: number; source: string; confidence: number | null; status: string;
}
interface Scenario { key: string; label: string }

function gbp(p: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(p / 100);
}

export default function SourceWorkspace({
  clientId, sourceId, transactions, categories, scenarios, catLabels,
}: {
  clientId: number; sourceId: number;
  transactions: Txn[]; categories: Cat[]; scenarios: Scenario[];
  catLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function post(url: string, body: object) {
    setBusy(true); setMsg("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? (j.imported != null ? `Imported ${j.imported} transactions.` : "Done.") : (j.error || "Error"));
    router.refresh();
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    await post("/api/transactions/import", { clientId, sourceId, csv: text });
  }

  const review = transactions.filter((t) => t.status === "review");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Collect + process</h2>
        <p className="text-xs text-slate-500">Bank CSV & receipts are categorised into HMRC categories by mock AI (confidence-scored). ≥80% auto-applies; below goes to review.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => post("/api/transactions/import", { clientId, sourceId, sample: true })} disabled={busy}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Load sample bank CSV</button>
          <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Upload CSV<input type="file" accept=".csv" onChange={importFile} className="hidden" /></label>
          <span className="text-slate-300">·</span>
          {scenarios.map((s) => (
            <button key={s.key} onClick={() => post("/api/transactions/receipt", { clientId, sourceId, scenario: s.key })} disabled={busy}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">{s.label}</button>
          ))}
        </div>
        {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
      </section>

      {review.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <h2 className="font-semibold">Review queue <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">{review.length}</span></h2>
          <div className="mt-3 space-y-2">
            {review.map((t) => <ReviewRow key={t.id} t={t} categories={categories} onDone={() => router.refresh()} />)}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Transactions ({transactions.length})</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr><th className="py-1">Date</th><th className="py-1">Description</th><th className="py-1">Category</th><th className="py-1 text-right">Amount</th><th className="py-1">Status</th></tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-1 text-slate-500">{t.txn_date}</td>
                <td className="py-1">{t.description}</td>
                <td className="py-1">{t.category ? (catLabels[t.category] ?? t.category) : "—"}</td>
                <td className={"py-1 text-right tabular-nums " + (t.direction === "income" ? "text-green-700" : "")}>
                  {t.direction === "income" ? "+" : "−"}{gbp(t.amount)}
                </td>
                <td className="py-1"><StatusBadge status={t.status} conf={t.confidence} /></td>
              </tr>
            ))}
            {transactions.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400">No transactions yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusBadge({ status, conf }: { status: string; conf: number | null }) {
  const map: Record<string, string> = {
    auto: "bg-green-100 text-green-700", confirmed: "bg-green-100 text-green-700",
    review: "bg-amber-100 text-amber-800", rejected: "bg-red-100 text-red-700",
  };
  const label = status === "auto" ? `Auto ${conf ? Math.round(conf * 100) + "%" : ""}` : status;
  return <span className={"rounded-full px-2 py-0.5 text-xs " + (map[status] ?? "bg-slate-100")}>{label}</span>;
}

function ReviewRow({ t, categories, onDone }: { t: Txn; categories: Cat[]; onDone: () => void }) {
  const [code, setCode] = useState(t.category ?? categories[0]?.code ?? "");
  const [busy, setBusy] = useState(false);
  const opts = categories.filter((c) => c.direction === t.direction);
  const overridden = code !== t.category;

  async function confirm() {
    setBusy(true);
    await fetch(`/api/transactions/${t.id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(overridden ? { overrideCategory: code } : {}) });
    setBusy(false); onDone();
  }
  async function reject() { setBusy(true); await fetch(`/api/transactions/${t.id}/reject`, { method: "POST" }); setBusy(false); onDone(); }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{t.description}</span>
          <span className="ml-2 text-xs text-slate-400">{t.txn_date} · {gbp(t.amount)} · {Math.round((t.confidence ?? 0) * 100)}% confidence</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={code} onChange={(e) => setCode(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            {opts.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <button onClick={confirm} disabled={busy} className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Confirm</button>
          <button onClick={reject} disabled={busy} className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
        </div>
      </div>
    </div>
  );
}
