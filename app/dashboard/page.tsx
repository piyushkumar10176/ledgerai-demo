import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { firmObligations } from "@/lib/obligations";
import { CURRENT_QUARTER, TAX_YEAR, daysUntil } from "@/lib/periods";
import AddClientForm from "@/components/AddClientForm";
import ControlTower from "@/components/ControlTower";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const obligations = await firmObligations(session.firmId, CURRENT_QUARTER);

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

      <div className="mt-6">
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
