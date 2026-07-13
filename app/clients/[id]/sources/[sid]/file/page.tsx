import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, getIncomeSource } from "@/lib/data";
import { computeQuarterlyUpdate, validateQuarter } from "@/lib/quarterly";
import { getSubmission, mockTaxEstimate } from "@/lib/quarterly-submit";
import { CURRENT_QUARTER, TAX_YEAR } from "@/lib/periods";
import { formatGBP } from "@/lib/money";
import QuarterlySubmit from "@/components/QuarterlySubmit";

export default async function FilePage({
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

  const q = CURRENT_QUARTER;
  const u = await computeQuarterlyUpdate(source.id, source.type, source.annual_turnover, q.taxYearStart, q.periodEnd);
  const errors = validateQuarter(u);
  const filed = await getSubmission(source.id, q.key);
  const tax = mockTaxEstimate(u.netProfit);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/clients/${clientId}/sources/${source.id}`} className="text-sm text-slate-500 hover:text-slate-800">← {source.business_name}</Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Quarterly update — {q.label} {TAX_YEAR}</h1>
      <p className="text-sm text-slate-500">
        {source.business_name} · cumulative {q.taxYearStart} → {q.periodEnd} · deadline {q.deadline}
      </p>

      <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600">
        <span className="font-medium">Deterministic</span> · summed from confirmed records, never AI ·
        {u.consolidated ? " consolidated expenses (< £90k)" : " full HMRC categories (≥ £90k)"}
      </div>

      {filed && (
        <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Already filed — ref <span className="font-mono">{JSON.parse(filed.hmrc_receipt || "{}").transactionReference}</span>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Panel title="Income">
          {u.incomeLines.length === 0 ? <Empty /> : u.incomeLines.map((l) => <LineRow key={l.code} label={l.label} amount={l.amount} />)}
          <Total label="Total income" amount={u.incomeTotal} />
        </Panel>
        <Panel title="Expenses">
          {u.expenseLines.length === 0 ? <Empty /> : u.expenseLines.map((l) => <LineRow key={l.code} label={l.label} amount={l.amount} />)}
          <Total label="Total expenses" amount={u.expenseTotal} />
        </Panel>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3">
        <span className="font-semibold text-indigo-900">Net profit (YTD)</span>
        <span className="text-xl font-bold tabular-nums text-indigo-900">{formatGBP(u.netProfit)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3">
        <div>
          <div className="text-sm font-medium">Estimated tax (via HMRC calc) <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">MOCK</span></div>
          <div className="text-xs text-slate-400">{tax.basis}</div>
        </div>
        <span className="text-lg font-semibold tabular-nums">{formatGBP(tax.estimate)}</span>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {errors.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}

      <div className="mt-6">
        <QuarterlySubmit clientId={clientId} sourceId={source.id} periodKey={q.key} alreadyFiled={!!filed} />
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}
function LineRow({ label, amount }: { label: string; amount: number }) {
  return <div className="flex justify-between border-t border-slate-100 py-1"><span>{label}</span><span className="tabular-nums">{formatGBP(amount)}</span></div>;
}
function Total({ label, amount }: { label: string; amount: number }) {
  return <div className="mt-1 flex justify-between border-t-2 border-slate-300 py-1 font-semibold"><span>{label}</span><span className="tabular-nums">{formatGBP(amount)}</span></div>;
}
function Empty() { return <div className="py-1 text-slate-400">None</div>; }
