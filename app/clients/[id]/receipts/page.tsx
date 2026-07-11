import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient, listCategoryAccounts } from "@/lib/data";
import { listReceipts } from "@/lib/receipts";
import { SCENARIOS, CONFIDENCE_THRESHOLD } from "@/lib/ocr-mock";
import ClientTabs from "@/components/ClientTabs";
import Receipts from "@/components/Receipts";

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  const client = getClient(session.firmId, clientId);
  if (!client) notFound();

  const receipts = listReceipts(clientId);
  const categories = listCategoryAccounts(clientId).map((a) => ({
    code: a.code,
    name: a.name,
  }));
  const scenarios = SCENARIOS.map((s) => ({ key: s.key, label: s.label }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <p className="text-sm text-slate-500">
        Receipts · OCR + AI categorisation (mocked) · review queue
      </p>
      <ClientTabs clientId={clientId} active="receipts" />

      <div className="mt-6">
        <Receipts
          clientId={clientId}
          receipts={receipts}
          scenarios={scenarios}
          categories={categories}
          threshold={CONFIDENCE_THRESHOLD}
        />
      </div>
    </main>
  );
}
