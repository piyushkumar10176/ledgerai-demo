import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { firmObligations } from "@/lib/obligations";
import AddClientForm from "@/components/AddClientForm";
import ControlTower from "@/components/ControlTower";

// Demo VAT quarter: 1 Apr – 30 Jun 2026, standard deadline 7 Aug 2026.
const PERIOD_START = "2026-04-01";
const PERIOD_END = "2026-06-30";
const DUE_DATE = "2026-08-07";

function daysUntil(iso: string): number {
  const due = new Date(iso + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const obligations = await firmObligations(session.firmId, PERIOD_START, PERIOD_END);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obligations control tower</h1>
          <p className="text-sm text-slate-500">
            Demo Accountants · who&apos;s filed, who&apos;s not, at a glance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/api/dev/seed-samples" method="post">
            <button
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              title="Populate the sample clients with a ledger, receipts and a VAT return"
            >
              Load sample data
            </button>
          </form>
          <form action="/api/dev/reset" method="post">
            <button
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              title="Clears all transactions but keeps clients and their chart of accounts"
            >
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
            label: "Q1 2026/27",
            start: PERIOD_START,
            end: PERIOD_END,
            due: DUE_DATE,
            daysLeft: daysUntil(DUE_DATE),
          }}
        />
      </div>
    </main>
  );
}
