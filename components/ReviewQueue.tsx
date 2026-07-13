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
  if (items.length === 0)
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center text-green-700">
        🎉 Nothing to review across any client. Inbox zero.
      </div>
    );

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <Row key={it.id} it={it}
          categories={it.source_type === "self-employment" ? seCategories : propertyCategories}
          onDone={() => router.refresh()} />
      ))}
    </div>
  );
}

function Row({ it, categories, onDone }: { it: Item; categories: Cat[]; onDone: () => void }) {
  const [code, setCode] = useState(it.category ?? categories[0]?.code ?? "");
  const [busy, setBusy] = useState(false);
  const opts = categories.filter((c) => c.direction === it.direction);
  const overridden = code !== it.category;

  async function confirm() {
    setBusy(true);
    await fetch(`/api/transactions/${it.id}/confirm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overridden ? { overrideCategory: code } : {}),
    });
    setBusy(false); onDone();
  }
  async function reject() { setBusy(true); await fetch(`/api/transactions/${it.id}/reject`, { method: "POST" }); setBusy(false); onDone(); }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">{it.description}</div>
          <div className="text-xs text-slate-400">
            {it.client_name} · {it.business_name} · {it.txn_date} · {gbp(it.amount)} ({it.direction})
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {Math.round((it.confidence ?? 0) * 100)}%
          </span>
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
