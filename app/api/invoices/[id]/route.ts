import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setInvoiceStatus } from "@/lib/invoicing";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { status } = await req.json();
  if (!["draft", "sent", "paid", "overdue"].includes(status))
    return NextResponse.json({ error: "Bad status" }, { status: 400 });
  await setInvoiceStatus(session.firmId, Number(id), status);
  return NextResponse.json({ ok: true });
}
