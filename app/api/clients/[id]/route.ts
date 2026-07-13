import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient, updateClientInfo } from "@/lib/data";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const client = await getClient(session.firmId, Number(id));
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();
  const fields: Record<string, string> = {};
  for (const k of ["name", "nino", "utr", "phone", "vrn"]) if (b[k] !== undefined) fields[k] = b[k];
  await updateClientInfo(session.firmId, client.id, fields);
  return NextResponse.json({ ok: true });
}
