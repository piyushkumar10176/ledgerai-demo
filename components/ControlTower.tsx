"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { statusLabel } from "@/lib/engine/mandation-engine";

type Status = "filed" | "ready" | "missing";
interface Obligation {
  clientId: number;
  clientName: string;
  mandationStatus: string;
  agentAuth: string;
  sourceId: number;
  businessName: string;
  sourceType: string;
  status: Status;
  reviewCount: number;
  netProfit: number | null;
  filedRef: string | null;
}

function gbp(p: number | null) {
  if (p == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(p / 100);
}

const META: Record<Status, { label: string; dot: string; pill: string; order: number }> = {
  missing: { label: "Missing data", dot: "bg-red-500", pill: "bg-red-100 text-red-700", order: 0 },
  ready: { label: "Ready to file", dot: "bg-amber-500", pill: "bg-amber-100 text-amber-800", order: 1 },
  filed: { label: "Filed", dot: "bg-green-500", pill: "bg-green-100 text-green-700", order: 2 },
};

export default function ControlTower({
  obligations,
  period,
}: {
  obligations: Obligation[];
  period: { label: string; taxYear: string; end: string; due: string; daysLeft: number };
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [chased, setChased] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  const counts = {
    missing: obligations.filter((o) => o.status === "missing").length,
    ready: obligations.filter((o) => o.status === "ready").length,
    filed: obligations.filter((o) => o.status === "filed").length,
  };
  const exceptions = obligations.reduce((s, o) => s + o.reviewCount, 0);

  async function bulkFile() {
    setBusy(true);
    const ready = obligations.filter((o) => o.status === "ready");
    for (const o of ready) {
      await fetch("/api/quarterly/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: o.clientId, sourceId: o.sourceId, periodKey: periodKeyFrom(period) }),
      });
    }
    setBusy(false);
    router.refresh();
  }

  const rows = [...obligations]
    .filter((o) => filter === "all" || o.status === filter)
    .sort((a, b) => META[a.status].order - META[b.status].order || a.clientName.localeCompare(b.clientName));

  const soon = period.daysLeft <= 30;

  return (
    <div>
      <div className={"flex flex-wrap items-center justify-between gap-2 rounded-xl border px-5 py-3 " + (soon ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white")}>
        <div>
          <div className="text-sm font-semibold">
            {period.label} · MTD Income Tax {period.taxYear} · cumulative to {period.end}
          </div>
          <div className="text-xs text-stone-500">Quarterly deadline {period.due}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className={"rounded-full px-3 py-1 text-sm font-medium " + (soon ? "bg-amber-200 text-amber-900" : "bg-stone-100 text-stone-700")}>
            {period.daysLeft} days to deadline
          </div>
          {counts.ready > 0 && (
            <button onClick={bulkFile} disabled={busy}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {busy ? "Filing…" : `Bulk-file ${counts.ready} ready`}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Missing data" value={counts.missing} dot="bg-red-500" />
        <Tile label="Ready to file" value={counts.ready} dot="bg-amber-500" />
        <Tile label="Filed" value={counts.filed} dot="bg-green-500" />
        <Tile label="Open exceptions" value={exceptions} dot="bg-brand-500" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "missing", "ready", "filed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={"rounded-full px-3 py-1 text-sm " + (filter === f ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600 hover:bg-stone-50")}>
            {f === "all" ? "All obligations" : META[f].label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="scroll-x">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Client · business</th>
              <th className="px-4 py-3">Mandation</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Exc.</th>
              <th className="px-4 py-3 text-right">Net profit (YTD)</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((o) => {
              const m = META[o.status];
              return (
                <tr key={o.sourceId} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${o.clientId}`} className="font-medium hover:underline">{o.clientName}</Link>
                    <div className="text-xs text-stone-400">
                      {o.businessName} · {o.sourceType === "self-employment" ? "Self-employment" : "UK property"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-xs " + (o.mandationStatus === "mandated" ? "bg-stone-100 text-stone-700" : "bg-stone-50 text-stone-400")}>
                      {statusLabel(o.mandationStatus)}
                    </span>
                    {o.agentAuth !== "linked" && (
                      <div className="mt-1 text-[10px] text-amber-600">agent auth: {o.agentAuth}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs " + m.pill}>
                      <span className={"h-1.5 w-1.5 rounded-full " + m.dot} />
                      {m.label}
                    </span>
                    {o.status === "filed" && o.filedRef && (
                      <div className="mt-1 font-mono text-[10px] text-stone-400">{o.filedRef}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {o.reviewCount > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{o.reviewCount}</span>
                    ) : <span className="text-stone-300">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{gbp(o.netProfit)}</td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "missing" ? (
                      chased[o.clientId] ? (
                        <span className="text-xs text-green-600">Reminder sent ✓</span>
                      ) : (
                        <button onClick={() => setChased((c) => ({ ...c, [o.clientId]: true }))}
                          className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Chase</button>
                      )
                    ) : o.status === "ready" ? (
                      <Link href={`/clients/${o.clientId}/sources/${o.sourceId}/file`}
                        className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">Review &amp; file →</Link>
                    ) : (
                      <Link href={`/clients/${o.clientId}/sources/${o.sourceId}/file`} className="text-xs text-stone-500 hover:text-stone-800">Open</Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">No obligations in this view.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-400">
        "Chase" and "Bulk-file" are mocked (no SMS/email or real HMRC submission). Net profit is
        the deterministic cumulative figure; AI never produces it.
      </p>
    </div>
  );
}

function periodKeyFrom(p: { label: string }) {
  // label like "Q1" -> "2026Q1"
  return "2026" + p.label;
}

function Tile({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={"h-2 w-2 rounded-full " + dot} />
        <span className="text-xs uppercase tracking-wide text-stone-500">{label}</span>
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
