import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients } from "@/lib/data";
import AddClientForm from "@/components/AddClientForm";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const clients = await listClients(session.firmId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-slate-500">Demo Accountants</p>
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

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Client</th>
              <th className="px-5 py-3">Company no.</th>
              <th className="px-5 py-3">VAT no.</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3 text-slate-500">{c.company_number ?? "—"}</td>
                <td className="px-5 py-3 text-slate-500">{c.vat_number ?? "—"}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/clients/${c.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  No clients yet — add one to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
