"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Acct {
  code: string;
  name: string;
}
interface Txn {
  id: number;
  txn_date: string;
  description: string;
  amount: number;
  entry_id: number | null;
}

function gbp(pennies: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pennies / 100);
}

export default function BankImport({
  clientId,
  transactions,
  incomeAccounts,
  expenseAccounts,
}: {
  clientId: number;
  transactions: Txn[];
  incomeAccounts: Acct[];
  expenseAccounts: Acct[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function importSample() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/bank/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, sample: true }),
    });
    const j = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Imported ${j.imported} transactions.` : j.error);
    router.refresh();
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    const text = await file.text();
    const res = await fetch("/api/bank/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, csv: text }),
    });
    const j = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Imported ${j.imported} transactions.` : j.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <button
          onClick={importSample}
          disabled={busy}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Load sample statement
        </button>
        <span className="text-sm text-slate-400">or</span>
        <label className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={importFile}
            className="hidden"
          />
        </label>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Categorise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((t) => (
              <TxnRow
                key={t.id}
                txn={t}
                accounts={t.amount > 0 ? incomeAccounts : expenseAccounts}
                onDone={() => router.refresh()}
              />
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No transactions yet — import a statement above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TxnRow({
  txn,
  accounts,
  onDone,
}: {
  txn: Txn;
  accounts: Acct[];
  onDone: () => void;
}) {
  const [code, setCode] = useState(accounts[0]?.code ?? "");
  const [vat, setVat] = useState("standard");
  const [busy, setBusy] = useState(false);

  async function post() {
    setBusy(true);
    await fetch("/api/bank/categorise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txnId: txn.id, accountCode: code, vat }),
    });
    setBusy(false);
    onDone();
  }

  const posted = txn.entry_id != null;
  return (
    <tr className={posted ? "bg-green-50/40" : ""}>
      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{txn.txn_date}</td>
      <td className="px-4 py-3">{txn.description}</td>
      <td
        className={
          "px-4 py-3 text-right font-medium " +
          (txn.amount > 0 ? "text-green-700" : "text-slate-800")
        }
      >
        {gbp(txn.amount)}
      </td>
      <td className="px-4 py-3">
        {posted ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
            Posted → ledger #{txn.entry_id}
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
            <select
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="standard">VAT 20%</option>
              <option value="none">No VAT</option>
            </select>
            <button
              onClick={post}
              disabled={busy || !code}
              className="rounded-md bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              Post
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
