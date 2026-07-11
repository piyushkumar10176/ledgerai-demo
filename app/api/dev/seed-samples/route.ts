import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { seedSampleData } from "@/lib/sample-data";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  seedSampleData(session.firmId);
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
