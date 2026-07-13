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
  const state = crypto.randomUUID();
  return NextResponse.redirect(buildAuthorizeUrl(state, scope));
}
