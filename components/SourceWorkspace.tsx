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
const emptyDraft = { txn_date: "2026-06-30", description: "", direction: "expense", category: "", amount: "" };

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
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState(emptyDraft);
  const [bulkCat, setBulkCat] = useState("");

  const catsFor = (dir: string) => categories.filter((c) => c.direction === dir);

  async function api(url: string, method: string, body?: object) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    return { ok: res.ok, j };
  }

  async function collect(url: string, body: object) {
    setMsg("");
    const { ok, j } = await api(url, "POST", body);
    setMsg(ok ? (j.imported != null ? `Imported ${j.imported}.` : "Added.") : (j.error || "Error"));
    router.refresh();
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    await collect("/api/transactions/import", { clientId, sourceId, csv: await f.text() });
  }

  async function addEntry() {
    if (!draft.description || !draft.amount || !draft.category) { setMsg("Fill description, amount, category."); return; }
    await collect("/api/transactions/create", { clientId, sourceId, ...draft });
    setDraft(emptyDraft); setAdding(false);
  }

  async function saveEdit(id: number) {
    await api(`/api/transactions/${id}`, "PATCH", edit);
    setEditId(null); router.refresh();
  }
  async function del(id: number) {
    await api(`/api/transactions/${id}`, "DELETE"); router.refresh();
  }
  async function bulk(action: string, category?: string) {
    if (sel.size === 0) return;
    await api("/api/transactions/bulk", "POST", { ids: [...sel], action, category });
    setSel(new Set()); setBulkCat(""); router.refresh();
  }

  function toggle(id: number) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  const allSel = transactions.length > 0 && sel.size === transactions.length;

  const badge: Record<string, string> = {
    auto: "bg-green-100 text-green-700", confirmed: "bg-green-100 text-green-700",
    manual: "bg-brand-100 text-brand-700", review: "bg-amber-100 text-amber-800", rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-5">
      {/* Collect */}
      <section className="card p-5">
        <h2 className="font-semibold">Collect &amp; categorise</h2>
        <p className="text-xs text-stone-500">Import a bank CSV or receipt — mock AI categorises into HMRC categories. ≥80% auto; below → review.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => collect("/api/transactions/import", { clientId, sourceId, sample: true })} disabled={busy} className="btn-primary">Load sample CSV</button>
          <label className="btn-ghost cursor-pointer">Upload CSV<input type="file" accept=".csv" onChange={importFile} className="hidden" /></label>
          <span className="text-stone-300">·</span>
          {scenarios.map((s) => (
            <button key={s.key} onClick={() => collect("/api/transactions/receipt", { clientId, sourceId, scenario: s.key })} disabled={busy} className="btn-ghost">🧾 {s.label}</button>
          ))}
        </div>
        {msg && <p className="mt-2 text-sm text-stone-600">{msg}</p>}
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding((v) => !v)} className="btn-primary">＋ Add entry</button>
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-stone-200 bg-white px-2 py-1 text-sm">
            <span className="px-1 text-stone-500">{sel.size} selected</span>
            <button onClick={() => bulk("confirm")} disabled={busy} className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">Accept</button>
            <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} className="rounded-full border border-stone-300 px-2 py-1 text-xs">
              <option value="">Recategorise…</option>
              {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            {bulkCat && <button onClick={() => bulk("recategorise", bulkCat)} disabled={busy} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white">Apply</button>}
            <button onClick={() => bulk("delete")} disabled={busy} className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
          </div>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="card p-4">
          <div className="grid gap-2 sm:grid-cols-6">
            <input type="date" value={draft.txn_date} onChange={(e) => setDraft({ ...draft, txn_date: e.target.value })} className="input sm:col-span-1" />
            <input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input sm:col-span-2" />
            <select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value, category: "" })} className="input">
              <option value="expense">Expense</option><option value="income">Income</option>
            </select>
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="input">
              <option value="">Category…</option>
              {catsFor(draft.direction).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <input placeholder="£ amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className="input" />
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={addEntry} disabled={busy} className="btn-primary">Save entry</button>
            <button onClick={() => { setAdding(false); setDraft(emptyDraft); }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2.5"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(transactions.map((t) => t.id)))} className="h-4 w-4 rounded border-stone-300" /></th>
                <th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {transactions.map((t) => editId === t.id ? (
                <tr key={t.id} className="bg-brand-50/40">
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"><input type="date" value={edit.txn_date} onChange={(e) => setEdit({ ...edit, txn_date: e.target.value })} className="input !py-1" /></td>
                  <td className="px-3 py-2"><input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="input !py-1" /></td>
                  <td className="px-3 py-2">
                    <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="input !py-1">
                      {catsFor(edit.direction).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} className="input !py-1 text-right" /></td>
                  <td className="px-3 py-2">
                    <select value={edit.direction} onChange={(e) => setEdit({ ...edit, direction: e.target.value, category: "" })} className="input !py-1">
                      <option value="expense">Expense</option><option value="income">Income</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => saveEdit(t.id)} disabled={busy} className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">Save</button>
                    <button onClick={() => setEditId(null)} className="ml-1 rounded-full border border-stone-300 px-3 py-1 text-xs">Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className={"hover:bg-stone-50 " + (sel.has(t.id) ? "bg-brand-50/40" : "")}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 rounded border-stone-300" /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-stone-500">{t.txn_date}</td>
                  <td className="px-3 py-2.5">{t.description}</td>
                  <td className="px-3 py-2.5">{t.category ? (catLabels[t.category] ?? t.category) : "—"}</td>
                  <td className={"px-3 py-2.5 text-right tabular-nums " + (t.direction === "income" ? "text-green-700" : "")}>{t.direction === "income" ? "+" : "−"}{gbp(t.amount)}</td>
                  <td className="px-3 py-2.5"><span className={"chip " + (badge[t.status] ?? "bg-stone-100")}>{t.status === "auto" ? `AI ${Math.round((t.confidence ?? 0) * 100)}%` : t.status}</span></td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => { setEditId(t.id); setEdit({ txn_date: t.txn_date, description: t.description, direction: t.direction, category: t.category ?? "", amount: String((t.amount / 100).toFixed(2)) }); }} className="text-brand-700 hover:underline">Edit</button>
                    <button onClick={() => del(t.id)} className="ml-3 text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-stone-400">No entries yet — import a CSV or add one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
