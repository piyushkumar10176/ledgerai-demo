import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { submitVatReturn } from "@/lib/vat-submit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, periodStart, periodEnd } = await req.json();
  const client = getClient(session.firmId, Number(clientId));
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!periodStart || !periodEnd)
    return NextResponse.json({ error: "Period required" }, { status: 400 });

  const result = submitVatReturn(
    session.firmId,
    client.id,
    periodStart,
    periodEnd,
  );
  return NextResponse.json({ ok: true, ...result });
}
