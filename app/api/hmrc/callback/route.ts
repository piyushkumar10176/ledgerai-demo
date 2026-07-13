import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exchangeCodeForToken } from "@/lib/hmrc";

// HMRC redirects here after the agent authorises. Configure this exact URL as a
// redirect URI on the Dev Hub: https://ledger-uk.vercel.app/api/hmrc/callback
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const err = req.nextUrl.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL(`/hmrc?error=${encodeURIComponent(err)}`, req.url));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/hmrc?error=no_code", req.url));

  const ok = await exchangeCodeForToken(session.firmId, code);
  return NextResponse.redirect(new URL(`/hmrc?${ok ? "connected=1" : "error=exchange_failed"}`, req.url));
}
