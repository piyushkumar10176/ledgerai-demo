import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { computeVatReturn, VAT_BOX_LABELS, type VatReturn } from "@/lib/vat";
import { listVatReturns } from "@/lib/vat-submit";
import { formatGBP } from "@/lib/money";
import ClientTabs from "@/components/ClientTabs";
import VatSubmit from "@/components/VatSubmit";

export default async function VatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  const client = await getClient(session.firmId, clientId);
  if (!client) notFound();

  const sp = await searchParams;
  const from = sp.from || "2026-04-01";
  const to = sp.to || "2026-06-30";

  const vat = await computeVatReturn(clientId, from, to);
  const history = await listVatReturns(clientId);

  const boxKeys = Object.keys(vat) as (keyof VatReturn)[];
  const highlight: (keyof VatReturn)[] = ["box3", "box5"];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <p className="text-sm text-slate-500">VAT return (MTD 9-box)</p>
      <ClientTabs clientId={clientId} active="vat" />

      {/* Period selector (deterministic recompute on the server) */}
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="block text-xs text-slate-500">Period from</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Period to</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50">
          Recalculate
        </button>
      </form>

      <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600">
        <span className="font-medium">Deterministic</span> · computed in code
        from the ledger, never by AI
      </div>

      {/* 9-box table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {boxKeys.map((k) => {
              const n = Number(k.replace("box", ""));
              const isHi = highlight.includes(k);
              return (
                <tr key={k} className={isHi ? "bg-indigo-50/60" : ""}>
                  <td className="w-14 px-4 py-3 text-center font-mono text-slate-400">
                    {n}
                  </td>
                  <td className="px-2 py-3">{VAT_BOX_LABELS[k]}</td>
                  <td
                    className={
                      "px-4 py-3 text-right font-medium tabular-nums " +
                      (isHi ? "text-indigo-800" : "")
                    }
                  >
                    {formatGBP(vat[k])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <VatSubmit clientId={clientId} periodStart={from} periodEnd={to} />
      </div>

      {/* Submission history */}
      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Submission history</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1">Period</th>
                <th className="py-1 text-right">Box 5 (net VAT)</th>
                <th className="py-1">Status</th>
                <th className="py-1">Form bundle</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const rec = h.hmrc_receipt ? JSON.parse(h.hmrc_receipt) : null;
                return (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="py-1">
                      {h.period_start} → {h.period_end}
                    </td>
                    <td className="py-1 text-right">{formatGBP(h.box5)}</td>
                    <td className="py-1">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        {h.status}
                      </span>
                    </td>
                    <td className="py-1 font-mono text-xs text-slate-500">
                      {rec?.formBundleNumber ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
