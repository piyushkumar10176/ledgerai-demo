import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import ServiceTabs from "@/components/ServiceTabs";

export default async function PayrollPage({
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
  if (!services.includes("payroll")) redirect(`/clients/${clientId}`);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <ServiceTabs clientId={clientId} active="payroll" services={services} />

      <div className="mt-6 card p-8 text-center">
        <div className="text-4xl">💷</div>
        <h2 className="mt-3 text-lg font-semibold">Payroll — integration, not built</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Per the product strategy, UK payroll (PAYE, National Insurance, auto-enrolment pension,
          student loan, RTI FPS/EPS, statutory pay) is a multi-year correctness grind with zero
          differentiation. LedgerAI <b>integrates / white-labels</b> an existing engine
          (e.g. BrightPay) rather than rebuilding it.
        </p>
        <div className="mx-auto mt-4 max-w-lg rounded-lg bg-slate-50 p-4 text-left text-xs text-slate-600">
          <div className="font-semibold text-slate-700">How UK payroll is calculated (per pay run):</div>
          <ul className="mt-1 space-y-0.5">
            <li>• <b>Income Tax</b> — tax code (e.g. 1257L) → free pay; 20% to £37,700, 40% to £125,140, 45% above (cumulative).</li>
            <li>• <b>National Insurance</b> — employee 8% (£12,570–£50,270) then 2%; employer ~15% above £9,100.</li>
            <li>• <b>Pension (auto-enrolment)</b> — employee 5% / employer 3% of qualifying earnings.</li>
            <li>• <b>Student loan</b> — Plan 1/2/4/5 + postgrad thresholds.</li>
            <li>• <b>RTI</b> — FPS each run, EPS monthly, to HMRC.</li>
          </ul>
        </div>
        <span className="mt-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          Placeholder — enable a payroll provider integration to activate
        </span>
      </div>
    </main>
  );
}
