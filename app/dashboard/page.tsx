import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { firmObligations } from "@/lib/obligations";
import { CURRENT_QUARTER, TAX_YEAR, daysUntil } from "@/lib/periods";
import { serviceCounts, SERVICES } from "@/lib/services";
import AddClientForm from "@/components/AddClientForm";
import ControlTower from "@/components/ControlTower";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const obligations = await firmObligations(session.firmId, CURRENT_QUARTER);
  const counts = await serviceCounts(session.firmId);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obligations control tower</h1>
          <p className="text-sm text-slate-500">
            Demo Accountants · MTD Income Tax quarterly filing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/api/dev/seed-samples" method="post">
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
              Load sample data
            </button>
          </form>
          <form action="/api/dev/reset" method="post">
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
              Reset demo data
            </button>
          </form>
          <AddClientForm />
        </div>
      </div>

      {/* Services across the practice */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SERVICES.map((s) => (
          <div key={s.key} className="card p-4">
            <div className="flex items-center gap-2">
              <span className={"flex h-8 w-8 items-center justify-center rounded-lg text-base " + s.chip}>{s.emoji}</span>
              <span className="text-xs uppercase tracking-wide text-slate-500">{s.label}</span>
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{counts[s.key] ?? 0}</div>
            <div className="text-[11px] text-slate-400">clients</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">MTD Income Tax — quarterly obligations</h2>
      <div className="mt-3">
        <ControlTower
          obligations={obligations}
          period={{
            label: CURRENT_QUARTER.label,
            taxYear: TAX_YEAR,
            end: CURRENT_QUARTER.periodEnd,
            due: CURRENT_QUARTER.deadline,
            daysLeft: daysUntil(CURRENT_QUARTER.deadline),
          }}
        />
      </div>
    </main>
  );
}
