import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { seedSampleData } from "@/lib/sample-data";

export async function POST(req: Request) {
  // Gated in production (audit fix) — same reasoning as /api/dev/reset.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_TOOLS !== "true")
    return NextResponse.json({ error: "Dev tools disabled in production." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  await seedSampleData(session.firmId);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
