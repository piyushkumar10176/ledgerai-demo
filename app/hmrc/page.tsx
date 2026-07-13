import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hmrcConnectivity, getAgentConnection, hmrcConfig } from "@/lib/hmrc";

export default async function HmrcPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const cfg = hmrcConfig();
  const check = await hmrcConnectivity();
  const conn = await getAgentConnection(session.firmId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">HMRC sandbox integration</h1>
      <p className="text-sm text-slate-500">Real HMRC Developer Sandbox — OAuth 2.0, fraud-prevention headers, live API calls.</p>

      {sp.connected && <Banner ok>Connected to HMRC — agent token stored.</Banner>}
      {sp.error && <Banner>Connect failed: {sp.error.replace(/_/g, " ")}. Check the Dev Hub setup below.</Banner>}

      <div className="mt-6 card p-5">
        <h2 className="font-semibold">Live status</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <StatusRow ok={check.configured} label="Credentials configured (client id + secret)" />
          <StatusRow ok={check.appTokenOk} label="Application token (client_credentials) obtained" />
          <StatusRow ok={check.helloOk} label={`Hello World API — ${check.helloMessage}`} />
          <StatusRow ok={!!conn} label={conn ? `Agent connected (scope: ${conn.scope ?? "—"})` : "Agent not connected (OAuth)"} />
        </ul>
      </div>

      <div className="mt-4 card p-5">
        <h2 className="font-semibold">Connect an agent (VAT/ITSA)</h2>
        <p className="mt-1 text-sm text-slate-500">Starts the OAuth authorization-code flow against the sandbox.</p>
        <a href="/api/hmrc/connect?scope=read:vat+write:vat"
          className="mt-3 inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
          Connect to HMRC (sandbox)
        </a>
        {process.env.HMRC_TEST_USER_ID && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Authorise with this sandbox test user</div>
            <div className="mt-1 font-mono text-slate-700">
              User ID: {process.env.HMRC_TEST_USER_ID}<br />
              Password: {process.env.HMRC_TEST_USER_PASSWORD}
            </div>
            <p className="mt-1 text-xs text-slate-400">Fay Ingham · VRN 466677396 · these are entered on HMRC&apos;s sandbox sign-in during Connect.</p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-sm">
        <h2 className="font-semibold text-amber-900">Dev Hub setup needed (your side, once)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-900">
          <li>Subscribe the app to APIs: <b>Hello World</b>, <b>VAT (MTD)</b>, <b>Income Tax (MTD)</b>.</li>
          <li>Add redirect URI: <code className="rounded bg-white px-1">{cfg.redirectUri}</code></li>
          <li>Create sandbox <b>test users</b> (Create Test User API) to authorise with.</li>
        </ol>
        <p className="mt-2 text-xs text-amber-800">Until these are set, application calls may 403 (not subscribed) and the OAuth redirect may be rejected. The wiring is real — it activates the moment the Dev Hub is configured.</p>
      </div>
    </main>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className={ok ? "text-green-600" : "text-slate-300"}>{ok ? "✓" : "○"}</span>
      <span className={ok ? "text-slate-800" : "text-slate-500"}>{label}</span>
    </li>
  );
}
function Banner({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <div className={"mt-4 rounded-md px-4 py-2 text-sm " + (ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
      {children}
    </div>
  );
}
