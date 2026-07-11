import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, listAccounts, listCategoryAccounts } from "@/lib/data";
import { listBankTransactions } from "@/lib/bank";
import ClientTabs from "@/components/ClientTabs";
import BankImport from "@/components/BankImport";

export default async function ImportPage({
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

  const transactions = await listBankTransactions(clientId);
  const incomeAccounts = (await listAccounts(clientId))
    .filter((a) => a.type === "INCOME")
    .map((a) => ({ code: a.code, name: a.name }));
  const expenseAccounts = (await listCategoryAccounts(clientId)).map((a) => ({
    code: a.code,
    name: a.name,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <p className="text-sm text-slate-500">Bank statement import (CSV)</p>
      <ClientTabs clientId={clientId} active="import" />

      <div className="mt-6">
        <BankImport
          clientId={clientId}
          transactions={transactions}
          incomeAccounts={incomeAccounts}
          expenseAccounts={expenseAccounts}
        />
      </div>
    </main>
  );
}
