import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { getYearEndData, clientTaxProjection, businessProfits } from "@/lib/yearend-data";
import { TAX_YEAR } from "@/lib/periods";
import { formatGBP } from "@/lib/money";
import ServiceTabs from "@/components/ServiceTabs";
import YearEndForm from "@/components/YearEndForm";

export default async function YearEndPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  const client = await getClient(session.firmId, clientId);
  if (!client) notFound();
  const services = await getClientServices(clientId);

  const [data, proj, profits] = await Promise.all([
    getYearEndData(clientId), clientTaxProjection(clientId), businessProfits(clientId),
  ]);

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>{client.name}</h1>
      <ServiceTabs clientId={clientId} active="mtd-itsa" services={services} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-bold">Year end &amp; final declaration · {TAX_YEAR}</h2>
        <span className="chip bg-brand-50 text-brand-700">Phase 3</span>
        <div className="flex-1" />
        <Link href={`/api/export/year-end/${clientId}`} className="btn-ghost">⬇ Working papers</Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <YearEndForm clientId={clientId} initial={data as unknown as Record<string, number>} declared={data.declared_at} />

        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="text-[12.5px] font-bold uppercase tracking-wide text-[#8a879a]">Business profits (from the books)</div>
            <div className="mt-2 space-y-1 text-[13px]">
              <Row k="Self-employment" v={formatGBP(profits.trading)} />
              <Row k="UK property" v={formatGBP(profits.property)} />
            </div>
          </div>

          <div className="rounded-2xl p-5 text-[#e9e6ff]" style={{ background: "linear-gradient(165deg,#1c1938,#2a2350)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold">Projected tax bill</span>
              <span className="chip" style={{ background: "rgba(124,108,245,.28)", color: "#cbbcff" }}>estimate</span>
            </div>
            <div className="mono mt-2 text-[30px] font-extrabold">{formatGBP(proj.result.totalDue)}</div>
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[12px]" style={{ color: "#d8d4f0" }}>
              {proj.result.breakdown.map((b) => (
                <div key={b.label} className="flex justify-between gap-3"><span>{b.label}</span><span className="mono">{formatGBP(b.amount)}</span></div>
              ))}
            </div>
            <p className="mt-3 text-[11px]" style={{ color: "#b9b4d8" }}>
              Deterministic, computed in code (rules {proj.result.version}) — never by AI. HMRC&apos;s Calculations API is authoritative for the real filing.
            </p>
          </div>

          <div className="card p-5">
            <div className="text-[12.5px] font-bold uppercase tracking-wide text-[#8a879a]">Allowances applied</div>
            <div className="mt-2 space-y-1 text-[13px]">
              <Row k="Personal allowance" v={formatGBP(proj.result.personalAllowance)} />
              <Row k="Total income" v={formatGBP(proj.result.totalIncome)} />
              <Row k="Taxable (non-savings)" v={formatGBP(proj.result.taxableIncome)} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-[#8a879a]">{k}</span><span className="mono font-bold">{v}</span></div>;
}
