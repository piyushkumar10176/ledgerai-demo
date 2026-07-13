import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { chartOfAccounts } from "@/lib/bookkeeping";
import { getAgentConnection } from "@/lib/hmrc";
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <ServiceTabs clientId={clientId} active="vat" services={services} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600">
          <span className="font-medium">Deterministic 9-box</span> · computed in code, never AI
        </span>
        <span className="rounded-md bg-amber-50 px-3 py-1 text-xs text-amber-800">
          Assumes standard-rated (20%), VAT-inclusive amounts — demo
        </span>
      </div>

      <div className="mt-4 card overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {(Object.keys(boxes) as (keyof typeof boxes)[]).map((k) => {
              const n = k.replace("box", "");
              const hi = k === "box3" || k === "box5";
              return (
                <tr key={k} className={hi ? "bg-indigo-50/60" : ""}>
                  <td className="w-12 px-4 py-3 text-center font-mono text-slate-400">{n}</td>
                  <td className="px-2 py-3">{BOX_LABELS[k]}</td>
                  <td className={"px-4 py-3 text-right font-medium tabular-nums " + (hi ? "text-indigo-800" : "")}>{formatGBP(boxes[k])}</td>
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
            <p className="text-xs text-slate-500">
              {conn ? "Agent connected. Obligations/submission via the real MTD VAT API." : "Not connected — real obligations & submission need an HMRC agent connection."}
            </p>
          </div>
          <Link href="/hmrc" className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50">
            {conn ? "Manage HMRC" : "Connect HMRC →"}
          </Link>
        </div>
      </div>
    </main>
  );
}
