"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddIncomeSource({ clientId }: { clientId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("self-employment");
  const [businessName, setBusinessName] = useState("");
  const [turnover, setTurnover] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/income-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, type, businessName, annualTurnover: turnover || 0 }),
    });
    setBusy(false);
    if (res.ok) {
      setBusinessName(""); setTurnover(""); setOpen(false); router.refresh();
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
        + Add income source
      </button>
    );

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="self-employment">Self-employment</option>
          <option value="uk-property">UK property</option>
        </select>
        <input placeholder="Business / property name *" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <input placeholder="Annual turnover £ (for £90k mode)" value={turnover} onChange={(e) => setTurnover(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="mt-2 flex gap-2">
        <button disabled={busy} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? "Adding…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm">Cancel</button>
      </div>
    </form>
  );
}

export function MagicLinkButton({ clientId }: { clientId: number }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function gen() {
    setBusy(true);
    const res = await fetch("/api/magiclink/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) setUrl(j.url);
  }

  return (
    <div>
      <button onClick={gen} disabled={busy} className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
        {busy ? "Generating…" : "Generate magic link"}
      </button>
      {url && (
        <div className="mt-2 rounded-md bg-indigo-50 p-2 text-xs">
          <div className="text-slate-500">Send to the client (mock — no SMS wired):</div>
          <a href={url} target="_blank" rel="noreferrer" className="break-all font-mono text-indigo-700 hover:underline">{url}</a>
        </div>
      )}
    </div>
  );
}
