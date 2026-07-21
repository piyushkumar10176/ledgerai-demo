import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { saveYearEndData } from "@/lib/yearend-data";
import { poundsToPennies } from "@/lib/money";

const MONEY = ["employment_income", "employment_tax_paid", "dividends", "interest",
  "pension_income", "pension_contributions", "gift_aid", "hicbc",
  "capital_allowances", "disallowables"] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const client = await getClient(session.firmId, Number(id));
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();

  const fields: Record<string, number | string | null> = {};
  for (const k of MONEY) if (b[k] !== undefined && b[k] !== "") fields[k] = poundsToPennies(Number(b[k]) || 0);
  if (b.student_loan_plan !== undefined) fields.student_loan_plan = b.student_loan_plan || null;
  if (b.declare) fields.declared_at = new Date().toISOString();

  await saveYearEndData(session.firmId, client.id, fields);
  return NextResponse.json({ ok: true });
}
