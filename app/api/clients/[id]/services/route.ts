import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { setClientServices } from "@/lib/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const client = await getClient(session.firmId, Number(id));
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { services } = await req.json();
  await setClientServices(client.id, Array.isArray(services) ? services : []);
  return NextResponse.json({ ok: true });
}
