import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient, getIncomeSource } from "@/lib/data";
import { addReceipt } from "@/lib/transactions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, sourceId, filename, scenario } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  const source = await getIncomeSource(session.firmId, Number(sourceId));
  if (!client || !source || source.client_id !== client.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await addReceipt(
    session.firmId,
    client.id,
    source.id,
    filename || "receipt.jpg",
    scenario,
  );
  return NextResponse.json({ ok: true, ...result });
}
