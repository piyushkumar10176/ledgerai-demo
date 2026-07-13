"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", nino: "", utr: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (res.ok) {
      setF({ name: "", nino: "", utr: "", phone: "" });
      setOpen(false);
      router.refresh();
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        + Add client
      </button>
    );

  return (
    <form onSubmit={submit} className="fixed right-6 top-16 z-50 w-80 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
      <h3 className="font-semibold">New client (taxpayer)</h3>
      <div className="mt-3 space-y-2">
        <input autoFocus placeholder="Full name *" value={f.name} onChange={(e) => set("name", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder="NINO (e.g. QQ123456C)" value={f.nino} onChange={(e) => set("nino", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder="UTR" value={f.utr} onChange={(e) => set("utr", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder="Mobile (for magic-link)" value={f.phone} onChange={(e) => set("phone", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm">Cancel</button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Add income sources on the client page. Mandation status is set by the checker.</p>
    </form>
  );
}
