import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, listIncomeSources } from "@/lib/data";
import { accountLedger } from "@/lib/bookkeeping";
import { categoryLabel } from "@/lib/hmrc-categories";
import { formatGBP } from "@/lib/money";

export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ id: string; category: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id, category } = await params;
  const clientId = Number(id);
  const client = await getClient(session.firmId, clientId);
  if (!client) notFound();

  const sources = await listIncomeSources(clientId);
  const type = sources[0]?.type ?? "self-employment";
  const label = categoryLabel(type, category);
  const txns = await accountLedger(clientId, category);
  const total = txns.reduce((s, t) => s + t.amount, 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/clients/${clientId}/bookkeeping`} className="text-sm text-stone-500 hover:text-stone-800">← Chart of accounts</Link>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
          <p className="text-sm text-stone-500">{client.name} · account ledger</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-stone-400">Balance</div>
          <div className="text-2xl font-bold tabular-nums">{formatGBP(total)}</div>
        </div>
      </div>

      <div className="mt-4 card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Description</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5 text-right">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {txns.map((t) => (
              <tr key={t.id} className="hover:bg-stone-50">
                <td className="px-4 py-2.5 text-stone-500">{t.txn_date}</td>
                <td className="px-4 py-2.5">{t.description}</td>
                <td className="px-4 py-2.5 text-stone-400">{t.business_name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatGBP(t.amount)}</td>
              </tr>
            ))}
            {txns.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No transactions.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
