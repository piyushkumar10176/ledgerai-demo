import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateTransaction, deleteTransaction } from "@/lib/transactions";
import { poundsToPennies } from "@/lib/money";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const fields: Record<string, unknown> = {};
  if (b.date !== undefined) fields.date = b.date;
  if (b.description !== undefined) fields.description = b.description;
  if (b.amount !== undefined) fields.amount = poundsToPennies(Number(b.amount));
  if (b.direction !== undefined) fields.direction = b.direction;
  if (b.category !== undefined) fields.category = b.category;
  if (b.status !== undefined) fields.status = b.status;
  await updateTransaction(session.firmId, Number(id), fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteTransaction(session.firmId, Number(id));
  return NextResponse.json({ ok: true });
}
