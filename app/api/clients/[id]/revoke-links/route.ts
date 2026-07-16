import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";
import { revokeMagicLinks } from "@/lib/magiclink";

// Kill every live magic link for a client (sent to the wrong number, client
// off-boarded, etc.). Firm-scoped like every other mutating route.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const clientId = Number(id);
  const client = await one<{ id: number }>(
    `SELECT id FROM clients WHERE id = ? AND firm_id = ?`,
    [clientId, session.firmId],
  );
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await revokeMagicLinks(session.firmId, clientId);
  return NextResponse.json({ revoked: true });
}
