import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient, getIncomeSource } from "@/lib/data";
import { submitQuarterlyUpdate } from "@/lib/quarterly-submit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, sourceId, periodKey } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  const source = await getIncomeSource(session.firmId, Number(sourceId));
  if (!client || !source || source.client_id !== client.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const result = await submitQuarterlyUpdate(
      session.firmId,
      client.id,
      source.id,
      periodKey || "2026Q1",
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
