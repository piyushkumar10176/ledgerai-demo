import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices, SERVICES } from "@/lib/services";
import { MagicLinkButton } from "@/components/ClientActions";
import ServiceTabs from "@/components/ServiceTabs";

export default async function ClientOverview({
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

  const mandation =
    client.mandation_status === "mandated"
      ? `Mandated${client.mandation_wave ? ` · wave ${client.mandation_wave}` : ""}`
      : client.mandation_status;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Control tower</Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {services.length === 0 && <span className="text-sm text-slate-400">No services selected yet</span>}
            {services.map((k) => {
              const s = SERVICES.find((d) => d.key === k)!;
              return <span key={k} className={"rounded-full px-2.5 py-1 text-xs font-medium " + s.chip}>{s.emoji} {s.label}</span>;
            })}
          </div>
        </div>
      </div>

      <ServiceTabs clientId={clientId} active="overview" services={services} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taxpayer</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Row k="NINO" v={client.nino ?? "—"} />
            <Row k="UTR" v={client.utr ?? "—"} />
            <Row k="Mandation" v={mandation} />
            <Row k="Agent authorisation" v={client.agent_auth_status} />
            <Row k="Mobile" v={client.phone ?? "—"} />
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collect data · zero client login</h2>
          <p className="mt-1 text-xs text-slate-500">Generate a magic link the client taps to upload a bank CSV or receipt — no app, no password.</p>
          <div className="mt-3"><MagicLinkButton clientId={clientId} /></div>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Services</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {services.map((k) => {
          const s = SERVICES.find((d) => d.key === k)!;
          return (
            <Link key={k} href={`/clients/${clientId}/${s.href}`} className="card card-hover flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <span className={"flex h-10 w-10 items-center justify-center rounded-xl text-lg " + s.chip}>{s.emoji}</span>
                <div>
                  <div className={"font-semibold " + s.accent}>{s.label}</div>
                  <div className="text-xs text-slate-500">{s.desc}</div>
                </div>
              </div>
              <span className="text-slate-300">→</span>
            </Link>
          );
        })}
        <Link href={`/clients/${clientId}/services`} className="card card-hover flex items-center justify-center p-5 text-sm text-slate-500">
          ⚙️ Manage services
        </Link>
      </div>
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
