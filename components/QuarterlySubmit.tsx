"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function QuarterlySubmit({
  clientId, sourceId, periodKey, alreadyFiled,
}: {
  clientId: number; sourceId: number; periodKey: string; alreadyFiled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Record<string, string> | null>(null);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/quarterly/submit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, sourceId, periodKey }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) { setReceipt(j.receipt); router.refresh(); }
  }

  if (receipt)
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-5">
        <div className="flex items-center gap-2 font-semibold text-green-800">
          ✓ Submitted to HMRC <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">MOCK</span>
        </div>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <div><dt className="text-stone-500">Transaction reference</dt><dd className="font-mono">{receipt.transactionReference}</dd></div>
          <div><dt className="text-stone-500">Period</dt><dd className="font-mono">{receipt.periodKey}</dd></div>
          <div className="sm:col-span-2"><dt className="text-stone-500">Processing date</dt><dd className="font-mono">{receipt.processingDate}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-amber-800">{receipt.note}</p>
      </div>
    );

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-stone-600">
        Cumulative YTD figures from the deterministic engine — no AI produces any number.
        The accountant approves, then submits.{alreadyFiled ? " A submission already exists; submitting again supersedes it (cumulative)." : ""}
      </p>
      <button onClick={submit} disabled={busy}
        className="mt-3 rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? "Submitting…" : alreadyFiled ? "Re-submit quarterly update (mock)" : "Submit quarterly update to HMRC (mock)"}
      </button>
    </div>
  );
}
