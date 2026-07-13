import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runMandationCheck } from "@/lib/mandation";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  await runMandationCheck(session.firmId);
  return NextResponse.redirect(new URL("/mandation", req.url));
}
