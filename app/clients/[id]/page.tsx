import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, listIncomeSources } from "@/lib/data";
import { formatGBP } from "@/lib/money";
import { AddIncomeSource, MagicLinkButton } from "@/components/ClientActions";

export default async function ClientPage({
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
  const sources = await listIncomeSources(clientId);

  const mandation =
    client.mandation_status === "mandated"
      ? `Mandated${client.mandation_wave ? ` · wave ${client.mandation_wave}` : ""}`
      : client.mandation_status;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Control tower</Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{client.name}</h1>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taxpayer</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="NINO" v={client.nino ?? "—"} />
            <Row k="UTR" v={client.utr ?? "—"} />
            <Row k="Mandation" v={mandation} />
            <Row k="Agent authorisation" v={client.agent_auth_status} />
            <Row k="Mobile" v={client.phone ?? "—"} />
          </dl>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collect data (zero client login)</h2>
          <p className="mt-1 text-xs text-slate-500">Generate a magic link the client taps to upload a bank CSV or receipt — no app, no password.</p>
          <div className="mt-3"><MagicLinkButton clientId={clientId} /></div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Income sources</h2>
      </div>
      <div className="mt-3 space-y-2">
        {sources.map((s) => (
          <Link key={s.id} href={`/clients/${clientId}/sources/${s.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50">
            <div>
              <div className="font-medium">{s.business_name}</div>
              <div className="text-xs text-slate-400">
                {s.type === "self-employment" ? "Self-employment" : "UK property"} · {s.accounting_method} basis ·
                turnover {formatGBP(s.annual_turnover)} ({s.annual_turnover < 9_000_000 ? "consolidated" : "full categories"})
              </div>
            </div>
            <span className="text-sm text-indigo-600">Open workspace →</span>
          </Link>
        ))}
        {sources.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
            No income sources yet — add one to start collecting and filing.
          </p>
        )}
      </div>
      <div className="mt-3"><AddIncomeSource clientId={clientId} /></div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
