import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { getClient, getIncomeSource } from "@/lib/data";
import { parseBankCsv } from "@/lib/csv";
import { importBankCsv } from "@/lib/transactions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, sourceId, csv, sample } = await req.json();
  const client = await getClient(session.firmId, Number(clientId));
  const source = await getIncomeSource(session.firmId, Number(sourceId));
  if (!client || !source || source.client_id !== client.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let text = csv as string;
  if (sample) {
    text = fs.readFileSync(path.join(process.cwd(), "data", "sample-bank.csv"), "utf8");
  }
  if (!text || !text.trim())
    return NextResponse.json({ error: "No CSV provided" }, { status: 400 });

  const rows = parseBankCsv(text);
  if (rows.length === 0)
    return NextResponse.json({ error: "No valid rows" }, { status: 400 });

  const count = await importBankCsv(session.firmId, client.id, source.id, rows);
  return NextResponse.json({ ok: true, imported: count });
}
