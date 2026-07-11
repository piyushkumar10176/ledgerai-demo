"use client";

import { useState } from "react";
import Link from "next/link";

type Status = "filed" | "ready" | "missing";
interface Obligation {
  clientId: number;
  clientName: string;
  status: Status;
  txnCount: number;
  reviewCount: number;
  netVat: number | null;
  formBundle: string | null;
}

function gbp(p: number | null) {
  if (p == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(p / 100);
}

const STATUS_META: Record<
  Status,
  { label: string; dot: string; pill: string; order: number }
> = {
  missing: { label: "Missing data", dot: "bg-red-500", pill: "bg-red-100 text-red-700", order: 0 },
  ready: { label: "Ready to file", dot: "bg-amber-500", pill: "bg-amber-100 text-amber-800", order: 1 },
  filed: { label: "Filed", dot: "bg-green-500", pill: "bg-green-100 text-green-700", order: 2 },
};

export default function ControlTower({
  obligations,
  period,
}: {
  obligations: Obligation[];
  period: { label: string; start: string; end: string; due: string; daysLeft: number };
}) {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [chased, setChased] = useState<Record<number, boolean>>({});

  const counts = {
    missing: obligations.filter((o) => o.status === "missing").length,
    ready: obligations.filter((o) => o.status === "ready").length,
    filed: obligations.filter((o) => o.status === "filed").length,
  };
  const toFile = obligations
    .filter((o) => o.status === "ready")
    .reduce((s, o) => s + (o.netVat ?? 0), 0);
  const exceptions = obligations.reduce((s, o) => s + o.reviewCount, 0);

  const rows = [...obligations]
    .filter((o) => filter === "all" || o.status === filter)
    .sort(
      (a, b) =>
        STATUS_META[a.status].order - STATUS_META[b.status].order ||
        a.clientName.localeCompare(b.clientName),
    );

  const overdueSoon = period.daysLeft <= 30;

  return (
    <div>
      {/* Deadline banner */}
      <div
        className={
          "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-5 py-3 " +
          (overdueSoon
            ? "border-amber-300 bg-amber-50"
            : "border-slate-200 bg-white")
        }
      >
        <div>
          <div className="text-sm font-semibold">
            {period.label} · VAT period {period.start} → {period.end}
          </div>
          <div className="text-xs text-slate-500">Filing deadline {period.due}</div>
        </div>
        <div
          className={
            "rounded-full px-3 py-1 text-sm font-medium " +
            (overdueSoon ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-700")
          }
        >
          {period.daysLeft} days to deadline
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Missing data" value={counts.missing} dot="bg-red-500" />
        <Tile label="Ready to file" value={counts.ready} dot="bg-amber-500" />
        <Tile label="Filed" value={counts.filed} dot="bg-green-500" />
        <Tile label="Open exceptions" value={exceptions} dot="bg-indigo-500" />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        <span className="font-medium text-slate-700">{gbp(toFile)}</span> of VAT
        ready to file across {counts.ready} client{counts.ready === 1 ? "" : "s"}.
      </p>

      {/* Filter */}
      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "missing", "ready", "filed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-3 py-1 text-sm " +
              (filter === f
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50")
            }
          >
            {f === "all" ? "All clients" : STATUS_META[f].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Txns</th>
              <th className="px-4 py-3 text-center">Exceptions</th>
              <th className="px-4 py-3 text-right">Net VAT</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((o) => {
              const m = STATUS_META[o.status];
              return (
                <tr key={o.clientId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{o.clientName}</td>
                  <td className="px-4 py-3">
                    <span className={"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs " + m.pill}>
                      <span className={"h-1.5 w-1.5 rounded-full " + m.dot} />
                      {m.label}
                    </span>
                    {o.status === "filed" && o.formBundle && (
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        {o.formBundle}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{o.txnCount}</td>
                  <td className="px-4 py-3 text-center">
                    {o.reviewCount > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {o.reviewCount}
                      </span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {gbp(o.netVat)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "missing" ? (
                      chased[o.clientId] ? (
                        <span className="text-xs text-green-600">Reminder sent ✓</span>
                      ) : (
                        <button
                          onClick={() =>
                            setChased((c) => ({ ...c, [o.clientId]: true }))
                          }
                          className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Chase
                        </button>
                      )
                    ) : o.status === "ready" ? (
                      <Link
                        href={`/clients/${o.clientId}/vat`}
                        className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Review & file →
                      </Link>
                    ) : (
                      <Link
                        href={`/clients/${o.clientId}`}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No clients in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        "Chase" is mocked (SMS/email delivery not wired). Deadline is the standard
        VAT date: one month + 7 days after period end.
      </p>
    </div>
  );
}

function Tile({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={"h-2 w-2 rounded-full " + dot} />
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
