import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient, createIncomeSource } from "@/lib/data";
import { poundsToPennies } from "@/lib/money";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, type, businessName, accountingMethod, annualTurnover } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (type !== "self-employment" && type !== "uk-property")
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (!businessName || !businessName.trim())
    return NextResponse.json({ error: "Business name required" }, { status: 400 });

  const id = await createIncomeSource(session.firmId, client.id, {
    type,
    businessName,
    accountingMethod: accountingMethod || "cash",
    annualTurnover: annualTurnover ? poundsToPennies(Number(annualTurnover)) : 0,
  });
  return NextResponse.json({ ok: true, id });
}
