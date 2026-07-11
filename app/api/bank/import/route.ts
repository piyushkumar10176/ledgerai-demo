import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { parseBankCsv } from "@/lib/csv";
import { importBankRows } from "@/lib/bank";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, csv, sample } = await req.json();
  const client = getClient(session.firmId, Number(clientId));
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let text = csv as string;
  if (sample) {
    text = fs.readFileSync(
      path.join(process.cwd(), "data", "sample-bank.csv"),
      "utf8",
    );
  }
  if (!text || !text.trim())
    return NextResponse.json({ error: "No CSV provided" }, { status: 400 });

  const rows = parseBankCsv(text);
  if (rows.length === 0)
    return NextResponse.json({ error: "No valid rows parsed" }, { status: 400 });

  const count = importBankRows(session.firmId, client.id, rows);
  return NextResponse.json({ ok: true, imported: count });
}
