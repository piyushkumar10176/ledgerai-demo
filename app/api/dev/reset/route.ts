import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resetFirmTransactions } from "@/lib/admin";

export async function POST(req: Request) {
  // Destructive — gated in production (audit fix): the shared demo login must
  // not let anonymous visitors wipe the shared database.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_TOOLS !== "true")
    return NextResponse.json({ error: "Dev tools disabled in production." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  await resetFirmTransactions(session.firmId);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
