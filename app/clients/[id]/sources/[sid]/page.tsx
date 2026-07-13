import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, getIncomeSource } from "@/lib/data";
import { listTransactions } from "@/lib/transactions";
import { categoriesFor } from "@/lib/hmrc-categories";
import { RECEIPT_SCENARIOS } from "@/lib/categorise-mock";
import SourceWorkspace from "@/components/SourceWorkspace";

export default async function SourcePage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id, sid } = await params;
  const clientId = Number(id);
  const client = await getClient(session.firmId, clientId);
  const source = await getIncomeSource(session.firmId, Number(sid));
  if (!client || !source || source.client_id !== clientId) notFound();

  const transactions = await listTransactions(source.id);
  const cats = categoriesFor(source.type);
  const categories = cats.map((c) => ({ code: c.code, label: c.label, direction: c.direction }));
  const catLabels = Object.fromEntries(cats.map((c) => [c.code, c.label]));
  const scenarios = RECEIPT_SCENARIOS.map((s) => ({ key: s.key, label: s.label.replace(/ \(.*\)$/, "") }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="text-sm text-slate-500 hover:text-slate-800">← {client.name}</Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{source.business_name}</h1>
          <p className="text-sm text-slate-500">
            {source.type === "self-employment" ? "Self-employment" : "UK property"} · {source.annual_turnover < 9_000_000 ? "consolidated expenses (< £90k)" : "full categories (≥ £90k)"}
          </p>
        </div>
        <Link href={`/clients/${clientId}/sources/${source.id}/file`}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Quarterly update →
        </Link>
      </div>

      <div className="mt-6">
        <SourceWorkspace
          clientId={clientId}
          sourceId={source.id}
          transactions={transactions}
          categories={categories}
          scenarios={scenarios}
          catLabels={catLabels}
        />
      </div>
    </main>
  );
}
