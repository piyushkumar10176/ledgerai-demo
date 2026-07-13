import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { confirmTransaction, rejectTransaction, deleteTransaction, updateTransaction } from "@/lib/transactions";

// Bulk-accept / reject selected transactions (the "review 30, bulk-accept" flow).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids, action, category } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "No ids" }, { status: 400 });

  let done = 0;
  for (const id of ids) {
    try {
      if (action === "reject") await rejectTransaction(session.firmId, Number(id));
      else if (action === "delete") await deleteTransaction(session.firmId, Number(id));
      else if (action === "recategorise" && category)
        await updateTransaction(session.firmId, Number(id), { category, status: "confirmed" });
      else await confirmTransaction(session.firmId, Number(id));
      done++;
    } catch {
      /* skip */
    }
  }
  return NextResponse.json({ ok: true, done });
}
