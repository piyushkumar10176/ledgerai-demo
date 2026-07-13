import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolveMagicLink, markMagicLinkUsed } from "@/lib/magiclink";
import { listIncomeSources } from "@/lib/data";
import { parseBankCsv } from "@/lib/csv";
import { importBankCsv, addReceipt } from "@/lib/transactions";

// PUBLIC — authenticated by the magic-link token, no session.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const target = await resolveMagicLink(token);
  if (!target) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const sources = await listIncomeSources(target.clientId);
  if (sources.length === 0)
    return NextResponse.json({ error: "No income source set up yet" }, { status: 400 });
  const source = sources[0];

  const { kind, csv, sample, scenario } = await req.json();

  if (kind === "receipt") {
    const r = await addReceipt(target.firmId, target.clientId, source.id, "client-upload.jpg", scenario);
    await markMagicLinkUsed(token);
    return NextResponse.json({ ok: true, kind: "receipt", ...r });
  }

  // default: bank CSV
  let text = csv as string;
  if (sample) text = fs.readFileSync(path.join(process.cwd(), "data", "sample-bank.csv"), "utf8");
  if (!text || !text.trim())
    return NextResponse.json({ error: "No CSV provided" }, { status: 400 });
  const rows = parseBankCsv(text);
  const count = await importBankCsv(target.firmId, target.clientId, source.id, rows);
  await markMagicLinkUsed(token);
  return NextResponse.json({ ok: true, kind: "bank", imported: count });
}
