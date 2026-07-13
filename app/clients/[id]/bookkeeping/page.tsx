import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { chartOfAccounts } from "@/lib/bookkeeping";
import { formatGBP } from "@/lib/money";
import ServiceTabs from "@/components/ServiceTabs";

export default async function BookkeepingPage({
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
  if (!services.includes("bookkeeping")) redirect(`/clients/${clientId}`);

  const coa = await chartOfAccounts(clientId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <ServiceTabs clientId={clientId} active="bookkeeping" services={services} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Income" value={formatGBP(coa.incomeTotal)} accent="text-green-700" />
        <Stat label="Expenses" value={formatGBP(coa.expenseTotal)} accent="text-stone-700" />
        <Stat label="Net profit" value={formatGBP(coa.netProfit)} accent="text-brand-700" highlight />
      </div>

      <p className="mt-6 text-xs text-stone-400">Chart of accounts — click any account to see its transactions.</p>
      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        <AccountList title="Income" accounts={coa.income} clientId={clientId} empty="No income posted." />
        <AccountList title="Expenses" accounts={coa.expenses} clientId={clientId} empty="No expenses posted." />
      </div>
    </main>
  );
}

function Stat({ label, value, accent, highlight }: { label: string; value: string; accent: string; highlight?: boolean }) {
  return (
    <div className={"card p-5 " + (highlight ? "ring-1 ring-brand-200" : "")}>
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className={"mt-1 text-2xl font-bold tabular-nums " + accent}>{value}</div>
    </div>
  );
}

function AccountList({ title, accounts, clientId, empty }: {
  title: string; accounts: { category: string; label: string; balance: number; count: number }[]; clientId: number; empty: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-stone-100 bg-stone-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</div>
      <ul className="divide-y divide-stone-100">
        {accounts.map((a) => (
          <li key={a.category}>
            <Link href={`/clients/${clientId}/bookkeeping/${a.category}`}
              className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-stone-50">
              <span className="flex items-center gap-2">
                <span className="text-stone-800">{a.label}</span>
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">{a.count}</span>
              </span>
              <span className="flex items-center gap-2 font-medium tabular-nums">{formatGBP(a.balance)}<span className="text-stone-300">→</span></span>
            </Link>
          </li>
        ))}
        {accounts.length === 0 && <li className="px-5 py-6 text-center text-sm text-stone-400">{empty}</li>}
      </ul>
    </div>
  );
}
