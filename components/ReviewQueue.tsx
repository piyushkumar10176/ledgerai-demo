"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cat { code: string; label: string; direction: string }
interface Item {
  id: number; client_name: string; business_name: string; source_type: string;
  txn_date: string; description: string; direction: string; category: string | null;
  amount: number; confidence: number | null;
}

function gbp(p: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(p / 100);
}

export default function ReviewQueue({
  items, seCategories, propertyCategories,
}: {
  items: Item[]; seCategories: Cat[]; propertyCategories: Cat[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  if (items.length === 0)
    return (
      <div className="card bg-green-50/60 p-10 text-center text-green-700">
        <div className="text-3xl">🎉</div>
        <p className="mt-2 font-medium">Nothing to review across any client. Inbox zero.</p>
      </div>
    );

  const allSelected = sel.size === items.length;
  function toggle(id: number) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSel(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  async function bulk(action: "confirm" | "reject") {
    if (sel.size === 0) return;
    setBusy(true);
    // apply any per-row overrides first (only affects confirm)
    if (action === "confirm") {
      for (const id of sel) {
        if (overrides[id]) {
          await fetch(`/api/transactions/${id}/confirm`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ overrideCategory: overrides[id] }),
          });
        }
      }
    }
    const remaining = [...sel].filter((id) => !(action === "confirm" && overrides[id]));
    if (remaining.length)
      await fetch("/api/transactions/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: remaining, action }),
      });
    setBusy(false); setSel(new Set()); setOverrides({}); router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-sm">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-stone-300" />
          Select all ({items.length})
        </label>
        <span className="text-sm text-stone-400">{sel.size} selected</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => bulk("confirm")} disabled={busy || sel.size === 0}
            className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40">
            ✓ Accept {sel.size || ""}
          </button>
          <button onClick={() => bulk("reject")} disabled={busy || sel.size === 0}
            className="rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
            Reject {sel.size || ""}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <Row key={it.id} it={it} checked={sel.has(it.id)} onToggle={() => toggle(it.id)}
            categories={it.source_type === "self-employment" ? seCategories : propertyCategories}
            override={overrides[it.id]} onOverride={(c) => setOverrides((o) => ({ ...o, [it.id]: c }))}
            onDone={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

function Row({ it, checked, onToggle, categories, override, onOverride, onDone }: {
  it: Item; checked: boolean; onToggle: () => void; categories: Cat[];
  override?: string; onOverride: (c: string) => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const opts = categories.filter((c) => c.direction === it.direction);
  const code = override ?? it.category ?? opts[0]?.code ?? "";

  async function confirm() {
    setBusy(true);
    const overridden = code !== it.category;
    await fetch(`/api/transactions/${it.id}/confirm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overridden ? { overrideCategory: code } : {}),
    });
    setBusy(false); onDone();
  }

  return (
    <div className={"card p-4 " + (checked ? "ring-1 ring-brand-300" : "")}>
      <div className="flex flex-wrap items-center gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 rounded border-stone-300" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{it.description}</div>
          <div className="text-xs text-stone-400">{it.client_name} · {it.business_name} · {it.txn_date} · {gbp(it.amount)} ({it.direction})</div>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{Math.round((it.confidence ?? 0) * 100)}%</span>
        <select value={code} onChange={(e) => onOverride(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
          {opts.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <button onClick={confirm} disabled={busy} className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Confirm</button>
      </div>
    </div>
  );
}
