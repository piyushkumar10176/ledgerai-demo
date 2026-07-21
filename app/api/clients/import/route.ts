import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseClientCsv, bulkImportClients } from "@/lib/onboarding";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { csv, services } = await req.json();
  if (!csv || !String(csv).trim()) return NextResponse.json({ error: "No CSV provided" }, { status: 400 });
  const rows = parseClientCsv(String(csv));
  if (rows.length === 0) return NextResponse.json({ error: "No client rows parsed" }, { status: 400 });
  const result = await bulkImportClients(session.firmId, rows, Array.isArray(services) && services.length ? services : ["mtd-itsa"]);
  return NextResponse.json({ ok: true, ...result, parsed: rows.length });
}
