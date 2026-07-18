import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { sendChase } from "@/lib/chasing";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, periodKey } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await sendChase(session.firmId, client.id, periodKey || "2026Q1");
  return NextResponse.json({ ok: true, ...result });
}
