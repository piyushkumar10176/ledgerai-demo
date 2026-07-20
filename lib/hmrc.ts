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

// Fraud-prevention headers (Gov-Client-*). A reasonable server-side subset for
// the demo; production must send the full validated set (validate via HMRC's
// Test Fraud Prevention Headers API).
export function fraudHeaders(): Record<string, string> {
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Device-ID": crypto.randomUUID(),
    "Gov-Client-Timezone": "UTC+00:00",
    "Gov-Vendor-Product-Name": "LedgerAI-UK",
    "Gov-Vendor-Version": "ledgerai-uk=0.1.0",
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
  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
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
  const row = await one<{ access_token: string; scope: string | null; expires_at: string | null }>(
    `SELECT access_token, scope, expires_at FROM hmrc_connections
      WHERE firm_id = ? AND kind = 'agent' ORDER BY id DESC LIMIT 1`,
    [firmId],
  );
  return row ?? null;
}

// VAT obligations (user-restricted). Returns rows, or an error string.
export interface VatObligation { start: string; end: string; due: string; status: string; periodKey?: string; received?: string }

export async function vatObligations(
  firmId: number,
  vrn: string,
): Promise<{ ok: boolean; obligations?: VatObligation[]; error?: string }> {
  const cfg = hmrcConfig();
  const conn = await getAgentConnection(firmId);
  if (!conn) return { ok: false, error: "Not connected to HMRC (no agent token)." };
  // The MTD VAT obligations endpoint requires a from/to window (≤ 366 days).
  const from = "2026-01-01", to = "2026-12-31";
  const res = await fetch(`${cfg.base}/organisations/vat/${vrn}/obligations?from=${from}&to=${to}`, {
    headers: {
      Accept: "application/vnd.hmrc.1.0+json",
      Authorization: `Bearer ${conn.access_token}`,
      // Sandbox test data (returns quarterly obligations for the test VRN).
      "Gov-Test-Scenario": "QUARTERLY_NONE_MET",
      ...fraudHeaders(),
    },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `${(j as { code?: string }).code ?? res.status}: ${(j as { message?: string }).message ?? "request failed"}` };
  return { ok: true, obligations: (j as { obligations?: VatObligation[] }).obligations ?? [] };
}

// --- MTD Income Tax (ITSA) ---

export interface ItsaBusiness { businessId: string; typeOfBusiness: string; tradingName?: string }

// Real Business Details (MTD) — lists the taxpayer's businesses (gives businessId).
export async function itsaBusinessList(
  firmId: number,
  nino: string,
): Promise<{ ok: boolean; businesses?: ItsaBusiness[]; error?: string }> {
  const cfg = hmrcConfig();
  const conn = await getAgentConnection(firmId);
  if (!conn) return { ok: false, error: "Not connected to HMRC." };
  const res = await fetch(`${cfg.base}/individuals/business/details/${nino}/list`, {
    headers: {
      Accept: "application/vnd.hmrc.1.0+json",
      Authorization: `Bearer ${conn.access_token}`,
      ...fraudHeaders(),
    },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `${(j as { code?: string }).code ?? res.status}: ${(j as { message?: string }).message ?? "request failed"}` };
  const list = ((j as { listOfBusinesses?: ItsaBusiness[] }).listOfBusinesses) ?? ((j as { businesses?: ItsaBusiness[] }).businesses) ?? [];
  return { ok: true, businesses: list };
}

// Real ITSA obligations (income-and-expenditure) for the taxpayer.
export async function itsaObligations(
  firmId: number,
  nino: string,
): Promise<{ ok: boolean; obligations?: unknown[]; error?: string }> {
  const cfg = hmrcConfig();
  const conn = await getAgentConnection(firmId);
  if (!conn) return { ok: false, error: "Not connected to HMRC." };
  const res = await fetch(`${cfg.base}/obligations/details/${nino}/income-and-expenditure?from=2026-04-06&to=2027-04-05`, {
    headers: {
      Accept: "application/vnd.hmrc.2.0+json",
      Authorization: `Bearer ${conn.access_token}`,
      "Gov-Test-Scenario": "QUARTERLY_NONE_MET",
      ...fraudHeaders(),
    },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `${(j as { code?: string }).code ?? res.status}: ${(j as { message?: string }).message ?? "request failed"}` };
  return { ok: true, obligations: (j as { obligations?: unknown[] }).obligations ?? [] };
}

// Submit a real MTD VAT return (9 boxes) to HMRC. Boxes are in PENNIES;
// HMRC wants pounds (5 VAT boxes 2dp, 4 value boxes whole pounds), finalised.
export async function submitVatReturn(
  firmId: number,
  vrn: string,
  periodKey: string,
  boxesPennies: { box1: number; box2: number; box3: number; box4: number; box5: number; box6: number; box7: number; box8: number; box9: number },
): Promise<{ ok: boolean; receipt?: Record<string, unknown>; error?: string; code?: string }> {
  const cfg = hmrcConfig();
  const conn = await getAgentConnection(firmId);
  if (!conn) return { ok: false, error: "Not connected to HMRC." };
  const p2 = (p: number) => Number((p / 100).toFixed(2));
  const whole = (p: number) => Math.round(p / 100);
  const b = boxesPennies;
  const body = {
    periodKey,
    vatDueSales: p2(b.box1),
    vatDueAcquisitions: p2(b.box2),
    totalVatDue: p2(b.box3),
    vatReclaimedCurrPeriod: p2(b.box4),
    netVatDue: p2(Math.abs(b.box5)),
    totalValueSalesExVAT: whole(b.box6),
    totalValuePurchasesExVAT: whole(b.box7),
    totalValueGoodsSuppliedExVAT: whole(b.box8),
    totalAcquisitionsExVAT: whole(b.box9),
    finalised: true,
  };
  const res = await fetch(`${cfg.base}/organisations/vat/${vrn}/returns`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${conn.access_token}`,
      ...fraudHeaders(),
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { code?: string; message?: string; errors?: { code?: string; message?: string }[] };
  if (!res.ok) {
    const nested = j.errors?.[0]?.code;
    const code = nested ?? j.code ?? String(res.status);
    return { ok: false, code, error: `${code}: ${j.errors?.[0]?.message ?? j.message ?? "submit failed"}` };
  }
  return { ok: true, receipt: j as Record<string, unknown> };
}
