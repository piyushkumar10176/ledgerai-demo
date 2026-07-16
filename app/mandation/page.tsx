import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { many } from "@/lib/db";
import { statusLabel } from "@/lib/engine/mandation-engine";

interface Row {
  id: number;
  name: string;
  nino: string | null;
  utr: string | null;
  mandation_status: string;
  mandation_wave: string | null;
  mandation_from: string | null;
  mandation_reasons: string | null;
  agent_auth_status: string;
}

export default async function MandationPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { imported } = await searchParams;

  const clients = await many<Row>(
    `SELECT id, name, nino, utr, mandation_status, mandation_wave,
            mandation_from, mandation_reasons, agent_auth_status
       FROM clients WHERE firm_id = ? ORDER BY name`,
    [session.firmId],
  );

  const badge = (s: string) =>
    s === "mandated" ? "bg-red-100 text-red-700"
    : s === "opt-out-eligible" || s === "ceased" ? "bg-violet-100 text-violet-700"
    : s === "voluntary" ? "bg-brand-100 text-brand-700"
    : s === "exempt" || s === "digitally-excluded" ? "bg-green-100 text-green-700"
    : s === "deferred-to-april-2027" || s === "digitally-excluded-pending" ? "bg-amber-100 text-amber-800"
    : "bg-stone-100 text-stone-500";

  const mandated = clients.filter((c) => c.mandation_status === "mandated");
  const notSignedUp = mandated.filter((c) => c.agent_auth_status !== "linked");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mandation checker</h1>
          <p className="text-sm text-stone-500">
            Which clients are pulled into MTD for Income Tax, in which wave — with the legal reasons.
          </p>
        </div>
        <form action="/api/mandation/check" method="post">
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Re-run mandation check
          </button>
        </form>
      </div>

      <div className="mt-2 inline-flex rounded-md bg-green-50 px-3 py-1 text-xs text-green-800">
        Real engine — SI 2026/336 rules (gross qualifying income, exemptions, deferrals, waves),
        verified by a 26-case legal test suite. Production adds HMRC ITSA-status reconciliation.
      </div>

      {imported && (
        <div className="mt-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Book imported and assessed. {mandated.length} mandated · {notSignedUp.length} mandated but not yet authorised.
        </div>
      )}

      {/* TRI-01: the book import — upload the firm's client list, get the report */}
      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700">Import client book (CSV)</h2>
        <p className="mt-1 text-xs text-stone-500">
          <code>clients.csv</code> (Name, NINO, UTR + exemption/deferral flags) and optionally{" "}
          <code>income.csv</code> (ClientRef, TaxYear, Type, GrossIncome — gross, never profit).
          Sample files ship in <code>samples/</code>. Rows with problems are skipped with a
          line-numbered reason, never guessed.
        </p>
        <form action="/api/book-import" method="post" encType="multipart/form-data"
              className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="text-stone-600">clients.csv{" "}
            <input type="file" name="clients" accept=".csv" required className="text-xs" />
          </label>
          <label className="text-stone-600">income.csv{" "}
            <input type="file" name="income" accept=".csv" className="text-xs" />
          </label>
          <button className="rounded-md bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-700">
            Import & assess
          </button>
        </form>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">NINO</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Wave / mandated from</th>
              <th className="px-4 py-3">Agent auth</th>
              <th className="px-4 py-3">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {clients.map((c) => {
              const reasons: string[] = c.mandation_reasons
                ? JSON.parse(c.mandation_reasons)
                : [];
              return (
                <tr key={c.id} className="align-top hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{c.nino ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={"whitespace-nowrap rounded-full px-2 py-0.5 text-xs " + badge(c.mandation_status)}>
                      {statusLabel(c.mandation_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {c.mandation_wave ? (
                      <>
                        Wave {c.mandation_wave}
                        {c.mandation_from && (
                          <div className="text-xs text-stone-400">from {c.mandation_from}</div>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={c.agent_auth_status === "linked" ? "text-green-600" : "text-amber-600"}>
                      {c.agent_auth_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {reasons.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-brand-600 hover:underline">
                          {reasons.length} reason{reasons.length > 1 ? "s" : ""}
                        </summary>
                        <ul className="mt-1 list-disc pl-4 text-xs text-stone-500">
                          {reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </details>
                    ) : (
                      <span className="text-xs text-stone-400">run the check</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                No clients yet — import your book above.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
