import { NextRequest, NextResponse } from "next/server";
import { resolveMagicLink } from "@/lib/magiclink";
import { recordApproval } from "@/lib/approvals";

// PUBLIC — the client approves their quarterly figures via the magic link.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = await resolveMagicLink(token);
  if (!target) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const { periodKey } = await req.json().catch(() => ({ periodKey: "2026Q1" }));
  await recordApproval(target.firmId, target.clientId, periodKey || "2026Q1", "magic-link");
  return NextResponse.json({ ok: true });
}
