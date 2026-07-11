"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VatSubmit({
  clientId,
  periodStart,
  periodEnd,
}: {
  clientId: number;
  periodStart: string;
  periodEnd: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Record<string, string> | null>(null);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/vat/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, periodStart, periodEnd }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setReceipt(j.receipt);
      router.refresh();
    }
  }

  if (receipt)
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-5">
        <div className="flex items-center gap-2 font-semibold text-green-800">
          <span>✓ Submitted to HMRC</span>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
            MOCK
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Form bundle number</dt>
            <dd className="font-mono">{receipt.formBundleNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Charge reference</dt>
            <dd className="font-mono">{receipt.chargeRefNumber}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Processing date</dt>
            <dd className="font-mono">{receipt.processingDate}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-amber-800">{receipt.note}</p>
      </div>
    );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">
        The accountant reviews the figures above, then submits. These numbers
        come straight from the deterministic engine — no AI is involved in any
        VAT figure.
      </p>
      <button
        onClick={submit}
        disabled={busy}
        className="mt-3 rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit to HMRC (mock)"}
      </button>
    </div>
  );
}
