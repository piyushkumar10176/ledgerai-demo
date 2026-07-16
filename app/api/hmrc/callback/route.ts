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

  // Validate the state we set on /connect (security audit fix — login CSRF).
  const returnedState = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("hmrc_oauth_state")?.value;
  if (!returnedState || !expectedState || returnedState !== expectedState)
    return NextResponse.redirect(new URL("/hmrc?error=bad_state", req.url));

  const ok = await exchangeCodeForToken(session.firmId, code);
  const res = NextResponse.redirect(
    new URL(`/hmrc?${ok ? "connected=1" : "error=exchange_failed"}`, req.url));
  res.cookies.delete("hmrc_oauth_state");
  return res;
}
