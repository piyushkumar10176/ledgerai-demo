import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, listAccounts, listJournalEntries } from "@/lib/data";
import { trialBalance } from "@/lib/ledger";
import { formatGBP } from "@/lib/money";
import ClientTabs from "@/components/ClientTabs";

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

  const tb = await trialBalance(clientId);
  const entries = await listJournalEntries(clientId, 20);
  const accounts = await listAccounts(clientId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <p className="text-sm text-slate-500">
        VAT {client.vat_number ?? "—"} · Company {client.company_number ?? "—"}
      </p>
      <ClientTabs clientId={clientId} active="overview" />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Trial balance */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Trial balance</h2>
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs " +
                (tb.balanced
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700")
              }
            >
              {tb.balanced ? "Balanced" : "UNBALANCED"}
            </span>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1">Account</th>
                <th className="py-1 text-right">Debit</th>
                <th className="py-1 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {tb.rows.map((r) => (
                <tr key={r.code} className="border-t border-slate-100">
                  <td className="py-1">
                    <span className="text-slate-400">{r.code}</span> {r.name}
                  </td>
                  <td className="py-1 text-right">
                    {r.debit ? formatGBP(r.debit) : ""}
                  </td>
                  <td className="py-1 text-right">
                    {r.credit ? formatGBP(r.credit) : ""}
                  </td>
                </tr>
              ))}
              {tb.rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-400">
                    No postings yet.
                  </td>
                </tr>
              )}
            </tbody>
            {tb.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-1">Total</td>
                  <td className="py-1 text-right">{formatGBP(tb.totalDebit)}</td>
                  <td className="py-1 text-right">{formatGBP(tb.totalCredit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        {/* Recent journal */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Recent journal entries</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between border-t border-slate-100 pt-2"
              >
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-xs text-slate-400">
                    {e.entry_date} · {e.source}
                  </div>
                </div>
                <div className="font-medium">{formatGBP(e.total)}</div>
              </li>
            ))}
            {entries.length === 0 && (
              <li className="py-4 text-center text-slate-400">
                No entries. Import a bank statement or upload a receipt.
              </li>
            )}
          </ul>
        </section>
      </div>

      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-semibold">
          Chart of accounts ({accounts.length})
        </summary>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-1 text-slate-400">{a.code}</td>
                <td className="py-1">{a.name}</td>
                <td className="py-1 text-right text-xs text-slate-400">{a.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </main>
  );
}
