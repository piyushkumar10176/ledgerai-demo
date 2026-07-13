"use client";

import { useState } from "react";

export default function MagicUpload({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function send(body: object) {
    setBusy(true);
    const res = await fetch(`/api/link/${token}/upload`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setDone(res.ok ? (j.kind === "receipt" ? "Receipt uploaded — thank you!" : `Uploaded ${j.imported} bank transactions — thank you!`) : (j.error || "Something went wrong"));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    await send({ kind: "bank", csv: text });
  }

  if (done)
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-center">
        <div className="text-3xl">✅</div>
        <p className="mt-2 font-medium text-green-800">{done}</p>
        <p className="mt-1 text-sm text-slate-500">You can close this page. Your accountant takes it from here.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <button onClick={() => send({ kind: "bank", sample: true })} disabled={busy}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        📄 Upload my bank statement (sample CSV)
      </button>
      <label className="block w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-center font-medium hover:bg-slate-50">
        📎 Choose a CSV file from my device
        <input type="file" accept=".csv" onChange={onFile} className="hidden" />
      </label>
      <button onClick={() => send({ kind: "receipt", scenario: "fuel" })} disabled={busy}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium hover:bg-slate-50 disabled:opacity-50">
        🧾 Snap a receipt (sample)
      </button>
      {busy && <p className="text-center text-sm text-slate-400">Uploading…</p>}
    </div>
  );
}
