import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { createMagicLink } from "@/lib/magiclink";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = await createMagicLink(session.firmId, client.id);
  const url = new URL(`/link/${token}`, req.url).toString();
  return NextResponse.json({ ok: true, token, url });
}
