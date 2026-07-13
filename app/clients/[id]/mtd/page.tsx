import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, listIncomeSources } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { formatGBP } from "@/lib/money";
import ServiceTabs from "@/components/ServiceTabs";
import { AddIncomeSource } from "@/components/ClientActions";

export default async function MtdPage({
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
  if (!services.includes("mtd-itsa")) redirect(`/clients/${clientId}`);
  const sources = await listIncomeSources(clientId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <ServiceTabs clientId={clientId} active="mtd-itsa" services={services} />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Income sources</h2>
      </div>
      <div className="mt-3 space-y-2">
        {sources.map((s) => (
          <Link key={s.id} href={`/clients/${clientId}/sources/${s.id}`}
            className="card card-hover flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{s.business_name}</div>
              <div className="text-xs text-stone-400">
                {s.type === "self-employment" ? "Self-employment" : "UK property"} · {s.accounting_method} basis ·
                turnover {formatGBP(s.annual_turnover)} ({s.annual_turnover < 9_000_000 ? "consolidated" : "full categories"})
              </div>
            </div>
            <span className="text-sm text-brand-600">Open workspace →</span>
          </Link>
        ))}
        {sources.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-200 p-4 text-sm text-stone-400">
            No income sources yet — add one to collect and file quarterly updates.
          </p>
        )}
      </div>
      <div className="mt-3"><AddIncomeSource clientId={clientId} /></div>
    </main>
  );
}
