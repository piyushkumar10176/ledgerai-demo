import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { createInvoice } from "@/lib/invoicing";
import { poundsToPennies } from "@/lib/money";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, amount } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!amount) return NextResponse.json({ error: "Amount required" }, { status: 400 });
  const id = await createInvoice(session.firmId, client.id, poundsToPennies(Number(amount)));
  return NextResponse.json({ ok: true, id });
}
