"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function VatSubmitReal({ clientId, connected }: { clientId: number; connected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [alreadyFiled, setAlreadyFiled] = useState(false);

  const green: React.CSSProperties = { background: "#16b364", boxShadow: "0 4px 14px rgba(22,179,100,.35)" };

  if (!connected)
    return (
      <Link href="/hmrc" className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white" style={green}>
        Connect &amp; file via MTD
      </Link>
    );

  async function submit() {
    setBusy(true); setError("");
    const res = await fetch("/api/hmrc/vat-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) });
    const j = await res.json();
    setBusy(false);
    if (res.ok) { setReceipt(j.receipt); router.refresh(); }
    else if (j.allFiled) setAlreadyFiled(true);
    else setError(j.error || "Submit failed");
  }

  if (alreadyFiled)
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-[13px] font-bold text-green-800">
        ✓ Already filed to HMRC — every open period for this VRN has been submitted (sandbox).
      </div>
    );

  if (receipt)
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-4">
        <div className="text-[13px] font-bold text-green-800">✓ Filed to HMRC (real MTD VAT API)</div>
        <div className="mono mt-2 text-[11.5px] text-green-900">
          {"formBundleNumber" in receipt && <>Form bundle: {String(receipt.formBundleNumber)}<br /></>}
          {"chargeRefNumber" in receipt && receipt.chargeRefNumber ? <>Charge ref: {String(receipt.chargeRefNumber)}<br /></> : null}
          {"processingDate" in receipt && <>Processed: {String(receipt.processingDate)}</>}
        </div>
      </div>
    );

  return (
    <div>
      <button onClick={submit} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white disabled:opacity-60" style={green}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>
        {busy ? "Submitting to HMRC…" : "Submit to HMRC"}
      </button>
      {error && <div className="mt-2 rounded-lg bg-[#fff4e5] px-3 py-2 text-[11.5px] text-[#b54708]">{error}</div>}
    </div>
  );
}
