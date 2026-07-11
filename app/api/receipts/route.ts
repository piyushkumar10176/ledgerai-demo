import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { processReceipt } from "@/lib/receipts";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, filename, scenario } = await req.json();
  const client = getClient(session.firmId, Number(clientId));
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = processReceipt(
    session.firmId,
    client.id,
    filename || "receipt.jpg",
    scenario,
  );
  return NextResponse.json({ ok: true, ...result });
}
