"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Fields { name: string; nino: string; utr: string; phone: string; vrn: string }

export default function ClientEditForm({ clientId, initial }: { clientId: number; initial: Fields }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Fields, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true);
    await fetch(`/api/clients/${clientId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false); setEditing(false); router.refresh();
  }

  if (!editing) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#8a879a]">Taxpayer details</h2>
          <button onClick={() => setEditing(true)} className="text-[12px] font-bold text-brand-600 hover:underline">Edit</button>
        </div>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row k="Name" v={initial.name} />
          <Row k="NINO" v={initial.nino || "—"} />
          <Row k="UTR" v={initial.utr || "—"} />
          <Row k="VRN" v={initial.vrn || "—"} />
          <Row k="Mobile" v={initial.phone || "—"} />
        </dl>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[#8a879a]">Edit taxpayer details</h2>
      <div className="mt-3 space-y-2">
        <Field label="Name" v={f.name} on={(v) => set("name", v)} />
        <Field label="NINO" v={f.nino} on={(v) => set("nino", v)} />
        <Field label="UTR" v={f.utr} on={(v) => set("utr", v)} />
        <Field label="VRN" v={f.vrn} on={(v) => set("vrn", v)} />
        <Field label="Mobile" v={f.phone} on={(v) => set("phone", v)} />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        <button onClick={() => { setEditing(false); setF(initial); }} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-[#8a879a]">{k}</dt><dd className="font-bold">{v}</dd></div>;
}
function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[#8a879a]">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} className="input mt-0.5" />
    </label>
  );
}
