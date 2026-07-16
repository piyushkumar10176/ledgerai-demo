import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession } from "@/lib/auth";
import { buildAuthorizeUrl, hmrcConfig } from "@/lib/hmrc";

// Start the HMRC OAuth authorization-code flow (agent connects). Requires the
// redirect URI + API subscriptions to be configured in the Dev Hub to succeed.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!hmrcConfig().configured)
    return NextResponse.redirect(new URL("/hmrc?error=not_configured", req.url));

  const scope = req.nextUrl.searchParams.get("scope") || "read:vat write:vat";
  // CSRF protection (security audit fix): state is stored in an httpOnly cookie
  // and must round-trip through HMRC — the callback validates it.
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(state, scope));
  res.cookies.set("hmrc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/hmrc",
    maxAge: 600,
  });
  return res;
}
