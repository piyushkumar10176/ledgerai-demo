"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, companyNumber, vatNumber }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setCompanyNumber("");
      setVatNumber("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        + Add client
      </button>
    );

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3 className="font-semibold">New client</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <input
          autoFocus
          placeholder="Business name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Company number"
          value={companyNumber}
          onChange={(e) => setCompanyNumber(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="VAT number"
          value={vatNumber}
          onChange={(e) => setVatNumber(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={busy}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save client"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Manual entry (Companies House lookup is out of demo scope). The client is
        seeded with a UK chart of accounts automatically.
      </p>
    </form>
  );
}
