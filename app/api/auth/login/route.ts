import { NextRequest, NextResponse } from "next/server";
import { authenticate, setSessionCookie } from "@/lib/auth";
import { ensureDemoData } from "@/lib/seed";

export async function POST(req: NextRequest) {
  await ensureDemoData();
  const { email, password } = await req.json();
  if (!email || !password)
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });

  const session = await authenticate(email, password);
  if (!session)
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  await setSessionCookie(session);
  return NextResponse.json({ ok: true });
}
