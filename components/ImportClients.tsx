"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bulk client onboarding (Phase 2): import a firm's client-list export.
export default function ImportClients() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function upload(csv: string) {
    setBusy(true); setMsg("");
    const res = await fetch("/api/clients/import", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }),
    });
    const j = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Imported ${j.created} client${j.created === 1 ? "" : "s"}${j.skipped ? ` · ${j.skipped} already existed` : ""}.` : j.error);
    router.refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    await upload(await f.text());
  }

  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost">⬆ Import list</button>;

  return (
    <div className="fixed right-6 top-20 z-50 w-96 card p-5 shadow-card">
      <h3 className="font-bold">Bulk import clients</h3>
      <p className="mt-1 text-[12px] text-[#8a879a]">Upload your IRIS / TaxCalc / Excel client-list export. Recognises Name, NINO, UTR, Phone columns.</p>
      <label className="btn-ghost mt-3 inline-block cursor-pointer">
        Choose CSV<input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      </label>
      <button
        onClick={() => upload("Name,NINO,UTR,Phone\nJordan Blake,QQ111222A,1122334455,07700 900901\nMaya Osei,QQ333444B,2233445566,07700 900902\nRuairi Flynn,QQ555666C,3344556677,07700 900903")}
        disabled={busy} className="btn-ghost ml-2">Try sample</button>
      {msg && <p className="mt-2 text-[12.5px] font-semibold text-green-600">{msg}</p>}
      <div className="mt-3"><button onClick={() => setOpen(false)} className="btn-ghost">Close</button></div>
    </div>
  );
}
