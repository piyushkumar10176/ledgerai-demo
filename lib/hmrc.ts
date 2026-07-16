import crypto from "node:crypto";
import { one, run } from "./db";

// Real HMRC sandbox integration. Application-restricted calls (client_credentials)
// work with just the client id/secret. User-restricted calls (VAT/ITSA) need the
// firm's agent to authorise via the OAuth authorization-code flow, which requires
// the redirect URI + API subscriptions + test users configured in the Dev Hub.

export function hmrcConfig() {
  const clientId = process.env.HMRC_CLIENT_ID || "";
  const clientSecret = process.env.HMRC_CLIENT_SECRET || "";
  const base = process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";
  const authBase = process.env.HMRC_AUTH_URL || "https://test-www.tax.service.gov.uk";
  const redirectUri =
    process.env.HMRC_REDIRECT_URI || "https://ledger-uk.vercel.app/api/hmrc/callback";
  return {
    clientId, clientSecret, base, authBase, redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}

// Fraud-prevention headers (Gov-Client-*), statutory under SI 2019/360.
// Expanded server-side set for WEB_APP_VIA_SERVER (audit fix: the device id is
// STABLE per deployment — a fresh uuid per request defeats its purpose — and
// the set now covers the user/timezone/screen headers HMRC validates).
// Production must still verify via HMRC's Test Fraud Prevention Headers API.
// Audit fix: NEVER derive the device id from the session-signing secret (that
// ships a hash of the secret to a third party). Dedicated env var, else a
// random id stable for the process lifetime.
const DEVICE_ID = process.env.HMRC_DEVICE_ID || crypto.randomUUID();

export function fraudHeaders(userId?: string | number): Record<string, string> {
  const now = new Date().toISOString();
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const tz = `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Device-ID": DEVICE_ID,
    "Gov-Client-User-IDs": `ledgerai=${encodeURIComponent(String(userId ?? "demo"))}`,
    "Gov-Client-Timezone": tz,
    "Gov-Client-Local-IPs-Timestamp": now,
    "Gov-Client-Screens": "width=1920&height=1080&scaling-factor=1&colour-depth=24",
    "Gov-Client-Window-Size": "width=1280&height=800",
    "Gov-Client-Browser-Do-Not-Track": "false",
    "Gov-Client-Multi-Factor": "",
    "Gov-Vendor-Product-Name": "LedgerAI%20UK",
    "Gov-Vendor-Version": "ledgerai-uk=0.2.0",
  };
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { base } = hmrcConfig();
  // OAuth token endpoints take application/x-www-form-urlencoded (audit fix).
  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body).toString(),
  });
  return (await res.json().catch(() => ({}))) as TokenResponse;
}

// Application (server) token via client_credentials — proves connectivity.
let _appToken: { token: string; exp: number } | null = null;
export async function getApplicationToken(): Promise<string | null> {
  const cfg = hmrcConfig();
  if (!cfg.configured) return null;
  if (_appToken && _appToken.exp > Date.now() + 30_000) return _appToken.token;
  const t = await tokenRequest({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "hello",
  });
  if (!t.access_token) return null;
  _appToken = { token: t.access_token, exp: Date.now() + (t.expires_in ?? 14400) * 1000 };
  return t.access_token;
}

export interface HmrcCheck {
  configured: boolean;
  appTokenOk: boolean;
  helloOk: boolean;
  helloMessage: string;
}

// Live connectivity check: get an app token and call /hello/application.
export async function hmrcConnectivity(): Promise<HmrcCheck> {
  const cfg = hmrcConfig();
  if (!cfg.configured) return { configured: false, appTokenOk: false, helloOk: false, helloMessage: "HMRC credentials not set." };
  const token = await getApplicationToken();
  if (!token) return { configured: true, appTokenOk: false, helloOk: false, helloMessage: "Could not obtain application token." };
  const res = await fetch(`${cfg.base}/hello/application`, {
    headers: { Accept: "application/vnd.hmrc.1.0+json", Authorization: `Bearer ${token}` },
  });
  const j = await res.json().catch(() => ({}));
  return {
    configured: true,
    appTokenOk: true,
    helloOk: res.ok,
    helloMessage: res.ok ? (j.message ?? "OK") : `${j.code ?? res.status}: ${j.message ?? "not subscribed to Hello World API"}`,
  };
}

// --- OAuth authorization-code flow (user-restricted, for VAT/ITSA) ---

export function buildAuthorizeUrl(state: string, scope: string): string {
  const cfg = hmrcConfig();
  const p = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope,
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `${cfg.authBase}/oauth/authorize?${p.toString()}`;
}

export async function exchangeCodeForToken(
  firmId: number,
  code: string,
): Promise<boolean> {
  const cfg = hmrcConfig();
  const t = await tokenRequest({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code,
  });
  if (!t.access_token) return false;
  const exp = new Date(Date.now() + (t.expires_in ?? 14400) * 1000).toISOString();
  await run(`DELETE FROM hmrc_connections WHERE firm_id = ? AND kind = 'agent'`, [firmId]);
  await run(
    `INSERT INTO hmrc_connections (firm_id, kind, access_token, refresh_token, scope, expires_at)
     VALUES (?, 'agent', ?, ?, ?, ?)`,
    [firmId, t.access_token, t.refresh_token ?? null, t.scope ?? null, exp],
  );
  return true;
}

export async function getAgentConnection(
  firmId: number,
): Promise<{ access_token: string; scope: string | null; expires_at: string | null } | null> {
  const row = await one<{
    id: number;
    access_token: string;
    refresh_token: string | null;
    scope: string | null;
    expires_at: string | null;
  }>(
    `SELECT id, access_token, refresh_token, scope, expires_at FROM hmrc_connections
      WHERE firm_id = ? AND kind = 'agent' ORDER BY id DESC LIMIT 1`,
    [firmId],
  );
  if (!row) return null;

  // Audit fix: use the refresh token — HMRC access tokens die after ~4 hours.
  const nearExpiry =
    row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 120_000;
  if (nearExpiry && row.refresh_token) {
    const cfg = hmrcConfig();
    const t = await tokenRequest({
      grant_type: "refresh_token",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: row.refresh_token,
    });
    if (t.access_token) {
      const exp = new Date(Date.now() + (t.expires_in ?? 14400) * 1000).toISOString();
      await run(
        `UPDATE hmrc_connections SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?`,
        [t.access_token, t.refresh_token ?? row.refresh_token, exp, row.id],
      );
      return { access_token: t.access_token, scope: row.scope, expires_at: exp };
    }
  }
  return { access_token: row.access_token, scope: row.scope, expires_at: row.expires_at };
}

// VAT obligations (user-restricted). Returns rows, or an error string.
export async function vatObligations(
  firmId: number,
  vrn: string,
): Promise<{ ok: boolean; obligations?: unknown[]; error?: string }> {
  const cfg = hmrcConfig();
  const conn = await getAgentConnection(firmId);
  if (!conn) return { ok: false, error: "Not connected to HMRC (no agent token)." };
  // from/to are required query params on this endpoint (audit fix).
  const now = new Date();
  const from = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const res = await fetch(
    `${cfg.base}/organisations/vat/${vrn}/obligations?from=${from}&to=${to}`,
    {
      headers: {
        Accept: "application/vnd.hmrc.1.0+json",
        Authorization: `Bearer ${conn.access_token}`,
        ...fraudHeaders(firmId),
      },
    },
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `${(j as { code?: string }).code ?? res.status}: ${(j as { message?: string }).message ?? "request failed"}` };
  return { ok: true, obligations: (j as { obligations?: unknown[] }).obligations ?? [] };
}
