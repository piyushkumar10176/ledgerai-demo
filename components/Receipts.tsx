"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Acct {
  code: string;
  name: string;
}
interface Scenario {
  key: string;
  label: string;
}
interface Receipt {
  id: number;
  filename: string;
  supplier: string | null;
  receipt_date: string | null;
  gross: number | null;
  vat: number | null;
  net: number | null;
  suggested_code: string | null;
  suggested_name: string | null;
  confidence: number | null;
  status: string;
  entry_id: number | null;
}

function gbp(p: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((p ?? 0) / 100);
}

export default function Receipts({
  clientId,
  receipts,
  scenarios,
  categories,
  threshold,
}: {
  clientId: number;
  receipts: Receipt[];
  scenarios: Scenario[];
  categories: Acct[];
  threshold: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function upload(scenario?: string, filename?: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        scenario,
        filename: filename ?? `${scenario ?? "receipt"}.jpg`,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok)
      setMsg(
        j.autoPosted
          ? `Auto-posted (confidence ${(j.confidence * 100).toFixed(0)}%).`
          : `Low confidence ${(j.confidence * 100).toFixed(0)}% → sent to review queue.`,
      );
    router.refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) await upload(undefined, f.name);
  }

  const queue = receipts.filter((r) => r.status === "review");
  const done = receipts.filter((r) => r.status !== "review");

  return (
    <div className="space-y-6">
      {/* Upload */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Upload a receipt</h2>
        <p className="text-xs text-slate-500">
          OCR + AI categorisation are <b>mocked</b> — no API key. Confidence ≥{" "}
          {(threshold * 100).toFixed(0)}% auto-posts; below goes to the review
          queue.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.key}
              onClick={() => upload(s.key)}
              disabled={busy}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
          <label className="cursor-pointer rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Upload file…
            <input type="file" onChange={onFile} className="hidden" />
          </label>
        </div>
        {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
      </section>

      {/* Review queue */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
        <h2 className="font-semibold">
          Review queue{" "}
          <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
            {queue.length}
          </span>
        </h2>
        {queue.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">
            Nothing to review. Upload a low-confidence receipt to see this in
            action.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {queue.map((r) => (
            <ReviewCard key={r.id} r={r} categories={categories} onDone={() => router.refresh()} />
          ))}
        </div>
      </section>

      {/* Processed */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Processed receipts</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="py-1">Supplier</th>
              <th className="py-1">Date</th>
              <th className="py-1 text-right">Gross</th>
              <th className="py-1">Category</th>
              <th className="py-1 text-right">Confidence</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-1">{r.supplier}</td>
                <td className="py-1 text-slate-500">{r.receipt_date}</td>
                <td className="py-1 text-right">{gbp(r.gross)}</td>
                <td className="py-1">
                  {r.suggested_code} {r.suggested_name}
                </td>
                <td className="py-1 text-right">
                  {r.confidence != null ? `${(r.confidence * 100).toFixed(0)}%` : "—"}
                </td>
                <td className="py-1">
                  <StatusBadge status={r.status} entryId={r.entry_id} />
                </td>
              </tr>
            ))}
            {done.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  None yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusBadge({ status, entryId }: { status: string; entryId: number | null }) {
  const map: Record<string, string> = {
    auto_posted: "bg-green-100 text-green-700",
    confirmed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    review: "bg-amber-100 text-amber-800",
  };
  const label =
    status === "auto_posted"
      ? `Auto-posted #${entryId}`
      : status === "confirmed"
        ? `Confirmed #${entryId}`
        : status === "rejected"
          ? "Rejected"
          : status;
  return (
    <span className={"rounded-full px-2 py-0.5 text-xs " + (map[status] ?? "bg-slate-100")}>
      {label}
    </span>
  );
}

function ReviewCard({
  r,
  categories,
  onDone,
}: {
  r: Receipt;
  categories: Acct[];
  onDone: () => void;
}) {
  const [code, setCode] = useState(r.suggested_code ?? categories[0]?.code ?? "");
  const [busy, setBusy] = useState(false);
  const overridden = code !== r.suggested_code;

  async function confirm() {
    setBusy(true);
    await fetch(`/api/receipts/${r.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overridden ? { overrideCode: code } : {}),
    });
    setBusy(false);
    onDone();
  }
  async function reject() {
    setBusy(true);
    await fetch(`/api/receipts/${r.id}/reject`, { method: "POST" });
    setBusy(false);
    onDone();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{r.supplier}</div>
          <div className="text-xs text-slate-500">
            {r.receipt_date} · {gbp(r.gross)} gross (net {gbp(r.net)}, VAT {gbp(r.vat)})
          </div>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          {r.confidence != null ? (r.confidence * 100).toFixed(0) : "—"}% confidence
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">AI suggested category:</span>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {categories.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} {a.name}
            </option>
          ))}
        </select>
        {overridden && (
          <span className="text-xs text-indigo-600">(overriding AI)</span>
        )}
        <button
          onClick={confirm}
          disabled={busy}
          className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Confirm & post
        </button>
        <button
          onClick={reject}
          disabled={busy}
          className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
