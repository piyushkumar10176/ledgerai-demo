"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewInvoice({ clients }: { clients: { id: number; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!amount) return;
    setBusy(true);
    await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, amount }) });
    setBusy(false); setAmount(""); setOpen(false); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="btn-primary">+ New invoice</button>;
  return (
    <div className="fixed right-6 top-20 z-50 w-80 card p-5 shadow-card">
      <h3 className="font-bold">New invoice</h3>
      <div className="mt-3 space-y-2">
        <select value={clientId} onChange={(e) => setClientId(Number(e.target.value))} className="input">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="£ amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={create} disabled={busy} className="btn-primary">{busy ? "…" : "Create draft"}</button>
        <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

export function MarkPaid({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function mark() {
    setBusy(true);
    await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) });
    setBusy(false); router.refresh();
  }
  return <button onClick={mark} disabled={busy} className="text-[11.5px] font-bold text-brand-600 hover:underline">{busy ? "…" : "Mark paid"}</button>;
}
