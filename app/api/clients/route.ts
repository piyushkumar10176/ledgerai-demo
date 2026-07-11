import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/data";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, companyNumber, vatNumber } = await req.json();
  if (!name || !name.trim())
    return NextResponse.json({ error: "Name required" }, { status: 400 });

  const id = await createClient(
    session.firmId,
    name,
    companyNumber || null,
    vatNumber || null,
  );
  return NextResponse.json({ ok: true, id });
}
