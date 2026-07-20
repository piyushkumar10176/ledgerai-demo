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

  // Find open obligations to file against.
  const obs = await vatObligations(session.firmId, client.vrn);
  if (!obs.ok) return NextResponse.json({ error: `Obligations: ${obs.error}` }, { status: 400 });
  const openPeriods = obs.obligations!.filter((o) => o.status === "O" && o.periodKey);
  if (openPeriods.length === 0) return NextResponse.json({ error: "No open VAT obligation to file" }, { status: 400 });

  // Deterministic 9-box (standard-rate assumption), in pennies.
  const coa = await chartOfAccounts(client.id);
  const box6 = Math.round(coa.incomeTotal / 1.2);
  const box1 = coa.incomeTotal - box6;
  const box7 = Math.round(coa.expenseTotal / 1.2);
  const box4 = coa.expenseTotal - box7;
  const boxes = { box1, box2: 0, box3: box1, box4, box5: Math.abs(box1 - box4), box6, box7, box8: 0, box9: 0 };

  // Try each open period; skip ones already filed (DUPLICATE_SUBMISSION).
  let lastErr = "";
  for (const o of openPeriods) {
    const result = await submitVatReturn(session.firmId, client.vrn, o.periodKey!, boxes);
    if (result.ok) {
      await logAudit(session.firmId, "vat.submitted.hmrc", "client", client.id, `period ${o.periodKey} · bundle ${(result.receipt as { formBundleNumber?: string }).formBundleNumber ?? "?"}`);
      return NextResponse.json({ ok: true, periodKey: o.periodKey, receipt: result.receipt });
    }
    lastErr = result.error ?? "submit failed";
    if (result.code !== "DUPLICATE_SUBMISSION") break; // real error → stop
  }
  // Every open period was already filed (or a real error).
  return NextResponse.json({ error: lastErr, allFiled: /DUPLICATE/i.test(lastErr) }, { status: 400 });
}
