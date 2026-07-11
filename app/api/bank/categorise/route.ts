import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { categoriseBankTransaction } from "@/lib/bank";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { txnId, accountCode, vat } = await req.json();
  if (!txnId || !accountCode)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const entryId = await categoriseBankTransaction(
      session.firmId,
      Number(txnId),
      String(accountCode),
      vat === "standard" ? "standard" : "none",
    );
    return NextResponse.json({ ok: true, entryId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
