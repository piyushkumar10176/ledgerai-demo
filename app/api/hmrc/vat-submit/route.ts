import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { chartOfAccounts } from "@/lib/bookkeeping";
import { vatObligations, submitVatReturn } from "@/lib/hmrc";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  if (!client || !client.vrn) return NextResponse.json({ error: "No VRN on this client" }, { status: 400 });

  // Find an open obligation to file against.
  const obs = await vatObligations(session.firmId, client.vrn);
  if (!obs.ok) return NextResponse.json({ error: `Obligations: ${obs.error}` }, { status: 400 });
  const open = obs.obligations!.find((o) => o.status === "O");
  if (!open?.periodKey) return NextResponse.json({ error: "No open VAT obligation to file" }, { status: 400 });

  // Deterministic 9-box (standard-rate assumption), in pennies.
  const coa = await chartOfAccounts(client.id);
  const box6 = Math.round(coa.incomeTotal / 1.2);
  const box1 = coa.incomeTotal - box6;
  const box7 = Math.round(coa.expenseTotal / 1.2);
  const box4 = coa.expenseTotal - box7;
  const boxes = { box1, box2: 0, box3: box1, box4, box5: Math.abs(box1 - box4), box6, box7, box8: 0, box9: 0 };

  const result = await submitVatReturn(session.firmId, client.vrn, open.periodKey, boxes);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await logAudit(session.firmId, "vat.submitted.hmrc", "client", client.id, `period ${open.periodKey} · bundle ${(result.receipt as { formBundleNumber?: string }).formBundleNumber ?? "?"}`);
  return NextResponse.json({ ok: true, periodKey: open.periodKey, receipt: result.receipt });
}
