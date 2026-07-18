import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildYearEndCsv } from "@/lib/yearend";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const pack = await buildYearEndCsv(session.firmId, Number(id));
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit(session.firmId, "yearend.exported", "client", Number(id));
  return new NextResponse(pack.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${pack.filename}"`,
    },
  });
}
