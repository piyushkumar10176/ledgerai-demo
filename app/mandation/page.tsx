import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients } from "@/lib/data";

export default async function MandationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const clients = await listClients(session.firmId);

  const badge = (s: string) =>
    s === "mandated" ? "bg-indigo-100 text-indigo-700"
    : s === "voluntary" ? "bg-slate-100 text-slate-600"
    : s === "not_mandated" ? "bg-slate-50 text-slate-400"
    : "bg-amber-100 text-amber-800";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mandation checker</h1>
          <p className="text-sm text-slate-500">Which clients are pulled into MTD for Income Tax, and in which wave.</p>
        </div>
        <form action="/api/mandation/check" method="post">
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Run mandation check
          </button>
        </form>
      </div>

      <div className="mt-2 inline-flex rounded-md bg-amber-50 px-3 py-1 text-xs text-amber-800">
        Mock — the real check calls HMRC&apos;s ITSA Status + Business Details APIs per client.
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">NINO</th><th className="px-4 py-3">Mandation</th><th className="px-4 py-3">Wave</th><th className="px-4 py-3">Agent auth</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.nino ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={"rounded-full px-2 py-0.5 text-xs " + badge(c.mandation_status)}>
                    {c.mandation_status === "not_mandated" ? "Not mandated" : c.mandation_status[0].toUpperCase() + c.mandation_status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.mandation_wave ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={c.agent_auth_status === "linked" ? "text-green-600" : "text-amber-600"}>{c.agent_auth_status}</span>
                </td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
