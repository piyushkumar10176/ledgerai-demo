import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resetFirmTransactions } from "@/lib/admin";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  await resetFirmTransactions(session.firmId);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
