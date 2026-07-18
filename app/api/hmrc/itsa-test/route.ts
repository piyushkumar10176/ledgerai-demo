import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { itsaBusinessList, itsaObligations } from "@/lib/hmrc";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clientId = Number(req.nextUrl.searchParams.get("clientId"));
  const client = await getClient(session.firmId, clientId);
  if (!client?.nino) return NextResponse.json({ error: "No NINO" }, { status: 400 });
  const [businesses, obligations] = await Promise.all([
    itsaBusinessList(session.firmId, client.nino),
    itsaObligations(session.firmId, client.nino),
  ]);
  return NextResponse.json({ nino: client.nino, businesses, obligations });
}
