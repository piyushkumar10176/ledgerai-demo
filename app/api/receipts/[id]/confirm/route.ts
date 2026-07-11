import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { confirmReceipt } from "@/lib/receipts";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const entryId = confirmReceipt(
      session.firmId,
      Number(id),
      body.overrideCode || undefined,
    );
    return NextResponse.json({ ok: true, entryId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
