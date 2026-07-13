import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { chartOfAccounts } from "@/lib/bookkeeping";
import { getAgentConnection, vatObligations } from "@/lib/hmrc";
import { formatGBP } from "@/lib/money";
import ServiceTabs from "@/components/ServiceTabs";

const BOX_LABELS: Record<string, string> = {
  box1: "VAT due on sales", box2: "VAT due on acquisitions (EU)", box3: "Total VAT due",
  box4: "VAT reclaimed on purchases", box5: "Net VAT to pay / reclaim",
  box6: "Total sales ex-VAT", box7: "Total purchases ex-VAT",
  box8: "Goods supplied to EU", box9: "Goods acquired from EU",
};

export default async function VatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  const client = await getClient(session.firmId, clientId);
  if (!client) notFound();
  const services = await getClientServices(clientId);
  if (!services.includes("vat")) redirect(`/clients/${clientId}`);

  // Deterministic 9-box, assuming standard-rated, VAT-inclusive amounts (demo).
  const coa = await chartOfAccounts(clientId);
  const box6 = Math.round(coa.incomeTotal / 1.2);
  const box1 = coa.incomeTotal - box6;
  const box7 = Math.round(coa.expenseTotal / 1.2);
  const box4 = coa.expenseTotal - box7;
  const boxes = { box1, box2: 0, box3: box1, box4, box5: Math.abs(box1 - box4), box6, box7, box8: 0, box9: 0 };

  const conn = await getAgentConnection(session.firmId);
  // Real HMRC MTD VAT obligations for this client's VRN (live once connected + subscribed).
  const vatObs = client.vrn ? await vatObligations(session.firmId, client.vrn) : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <ServiceTabs clientId={clientId} active="vat" services={services} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-3 py-1 text-xs text-stone-600">
          <span className="font-medium">Deterministic 9-box</span> · computed in code, never AI
        </span>
        <span className="rounded-md bg-amber-50 px-3 py-1 text-xs text-amber-800">
          Assumes standard-rated (20%), VAT-inclusive amounts — demo
        </span>
      </div>

      <div className="mt-4 card overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-stone-100">
            {(Object.keys(boxes) as (keyof typeof boxes)[]).map((k) => {
              const n = k.replace("box", "");
              const hi = k === "box3" || k === "box5";
              return (
                <tr key={k} className={hi ? "bg-brand-50/60" : ""}>
                  <td className="w-12 px-4 py-3 text-center font-mono text-stone-400">{n}</td>
                  <td className="px-2 py-3">{BOX_LABELS[k]}</td>
                  <td className={"px-4 py-3 text-right font-medium tabular-nums " + (hi ? "text-brand-800" : "")}>{formatGBP(boxes[k])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">HMRC MTD VAT (sandbox)</h2>
            <p className="text-xs text-stone-500">
              {client.vrn ? <>VRN <span className="font-mono">{client.vrn}</span> · </> : "No VRN on file · "}
              {conn ? "agent connected — live obligations below." : "connect an agent to pull real obligations."}
            </p>
          </div>
          <Link href="/hmrc" className="rounded-md border border-brand-300 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50">
            {conn ? "Manage HMRC" : "Connect HMRC →"}
          </Link>
        </div>

        {client.vrn && (
          <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Live VAT obligations (real MTD VAT API)</div>
            {!vatObs ? null : vatObs.ok ? (
              <ul className="mt-2 space-y-1">
                {(vatObs.obligations as { start: string; end: string; due: string; status: string; periodKey?: string }[]).map((o, i) => (
                  <li key={i} className="flex items-center justify-between border-t border-stone-200 py-1">
                    <span>{o.start} → {o.end} <span className="text-stone-400">(due {o.due})</span></span>
                    <span className={"rounded-full px-2 py-0.5 text-xs " + (o.status === "F" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800")}>
                      {o.status === "F" ? "Fulfilled" : "Open"}
                    </span>
                  </li>
                ))}
                {(vatObs.obligations as unknown[]).length === 0 && <li className="mt-1 text-stone-400">No obligations returned.</li>}
              </ul>
            ) : (
              <p className="mt-2 text-amber-700">{vatObs.error} — once the app is subscribed to the VAT (MTD) API and an agent is connected, real obligations appear here.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
