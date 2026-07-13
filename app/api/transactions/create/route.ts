import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient, getIncomeSource } from "@/lib/data";
import { createManualTransaction } from "@/lib/transactions";
import { poundsToPennies } from "@/lib/money";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, sourceId, date, description, amount, direction, category } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  const source = await getIncomeSource(session.firmId, Number(sourceId));
  if (!client || !source || source.client_id !== client.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!date || !description || !amount || !category)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const id = await createManualTransaction(session.firmId, client.id, source.id, {
    date,
    description,
    amount: poundsToPennies(Number(amount)),
    direction: direction === "income" ? "income" : "expense",
    category,
  });
  return NextResponse.json({ ok: true, id });
}
