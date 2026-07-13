import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { firmObligations } from "@/lib/obligations";
import { CURRENT_QUARTER, TAX_YEAR, daysUntil } from "@/lib/periods";
import { serviceCounts, SERVICES } from "@/lib/services";
import { formatGBP } from "@/lib/money";
import AddClientForm from "@/components/AddClientForm";
import ControlTower from "@/components/ControlTower";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [clients, obligations, counts] = await Promise.all([
    listClients(session.firmId),
    firmObligations(session.firmId, CURRENT_QUARTER),
    serviceCounts(session.firmId),
  ]);

  const filed = obligations.filter((o) => o.status === "filed").length;
  const ready = obligations.filter((o) => o.status === "ready").length;
  const missing = obligations.filter((o) => o.status === "missing").length;
  const total = obligations.length || 1;
  const exceptions = obligations.reduce((s, o) => s + o.reviewCount, 0);
  const readyProfit = obligations
    .filter((o) => o.status === "ready")
    .reduce((s, o) => s + (o.netProfit ?? 0), 0);
  const mandated = clients.filter((c) => c.mandation_status === "mandated").length;
  const days = daysUntil(CURRENT_QUARTER.deadline);
  const pct = Math.round((filed / total) * 100);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-700">Demo Accountants · {TAX_YEAR}</p>
          <h1 className="mt-1 text-4xl font-bold">Practice dashboard</h1>
          <p className="mt-1 text-stone-500">MTD Income Tax · {CURRENT_QUARTER.label} closes into the {CURRENT_QUARTER.deadline} deadline.</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/api/dev/seed-samples" method="post"><button className="btn-ghost">Load sample</button></form>
          <form action="/api/dev/reset" method="post"><button className="btn-ghost">Reset</button></form>
          <AddClientForm />
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Clients" value={String(clients.length)} icon="👥" sub={`${mandated} mandated`} />
        <Kpi label="Ready to file" value={String(ready)} icon="📤" sub={formatGBP(readyProfit) + " profit"} tone="amber" />
        <Kpi label="Filed" value={String(filed)} icon="✅" sub={`of ${total} obligations`} tone="green" />
        <Kpi label="Missing data" value={String(missing)} icon="⏳" sub="need chasing" tone="red" />
        <Kpi label="Exceptions" value={String(exceptions)} icon="🔎" sub="to review" tone="brand" />
        <Kpi label="Deadline" value={`${days}d`} icon="⏱️" sub={CURRENT_QUARTER.deadline} tone={days <= 30 ? "amber" : undefined} />
      </div>

      {/* Progress + needs attention */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card flex items-center gap-5 p-6">
          <Donut filed={filed} ready={ready} missing={missing} pct={pct} />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Quarter progress</h2>
            <p className="mt-1 text-3xl font-bold">{pct}%</p>
            <p className="text-sm text-stone-500">{filed} of {total} filed</p>
            <div className="mt-3 space-y-1 text-xs">
              <Legend color="bg-green-500" label="Filed" n={filed} />
              <Legend color="bg-amber-500" label="Ready" n={ready} />
              <Legend color="bg-red-500" label="Missing" n={missing} />
            </div>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Needs attention</h2>
            <span className="chip bg-red-100 text-red-700">{missing} missing</span>
          </div>
          <ul className="mt-3 divide-y divide-stone-100">
            {obligations.filter((o) => o.status === "missing").map((o) => (
              <li key={o.sourceId} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <Link href={`/clients/${o.clientId}`} className="font-medium hover:text-brand-700 hover:underline">{o.clientName}</Link>
                  <span className="ml-2 text-xs text-stone-400">{o.businessName}</span>
                </div>
                <Link href={`/clients/${o.clientId}`} className="chip bg-stone-100 text-stone-600 hover:bg-stone-200">Collect →</Link>
              </li>
            ))}
            {missing === 0 && <li className="py-6 text-center text-sm text-stone-400">Everyone has data in. 🎉</li>}
          </ul>
        </div>
      </div>

      {/* Service mix */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SERVICES.map((s) => (
          <div key={s.key} className="card p-4">
            <div className="flex items-center gap-2">
              <span className={"flex h-8 w-8 items-center justify-center rounded-lg text-base " + s.chip}>{s.emoji}</span>
              <span className="text-xs uppercase tracking-wide text-stone-500">{s.label}</span>
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{counts[s.key] ?? 0}</div>
            <div className="text-[11px] text-stone-400">clients</div>
          </div>
        ))}
      </div>

      {/* Control tower */}
      <h2 className="mt-10 text-lg font-bold">Quarterly obligations</h2>
      <p className="text-sm text-stone-500">Every client × income source · red/amber/green · one-click chase &amp; bulk-file.</p>
      <div className="mt-3">
        <ControlTower
          obligations={obligations}
          period={{ label: CURRENT_QUARTER.label, taxYear: TAX_YEAR, end: CURRENT_QUARTER.periodEnd, due: CURRENT_QUARTER.deadline, daysLeft: days }}
        />
      </div>
    </main>
  );
}

function Kpi({ label, value, icon, sub, tone }: { label: string; value: string; icon: string; sub: string; tone?: "green" | "amber" | "red" | "brand" }) {
  const toneMap: Record<string, string> = {
    green: "text-green-700", amber: "text-amber-700", red: "text-red-700", brand: "text-brand-700",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className={"mt-1 text-3xl font-bold tabular-nums " + (tone ? toneMap[tone] : "text-stone-900")}>{value}</div>
      <div className="text-[11px] text-stone-400">{sub}</div>
    </div>
  );
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <div className="flex items-center gap-2 text-stone-600">
      <span className={"h-2 w-2 rounded-full " + color} />{label}<span className="ml-auto font-medium tabular-nums">{n}</span>
    </div>
  );
}

// Pure-SVG progress donut (filed / ready / missing).
function Donut({ filed, ready, missing, pct }: { filed: number; ready: number; missing: number; pct: number }) {
  const total = filed + ready + missing || 1;
  const r = 42, c = 2 * Math.PI * r;
  const seg = (n: number) => (n / total) * c;
  const green = seg(filed), amber = seg(ready), red = seg(missing);
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e7e5e4" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="10" strokeDasharray={`${green} ${c - green}`} strokeDashoffset={0} strokeLinecap="butt" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f59e0b" strokeWidth="10" strokeDasharray={`${amber} ${c - amber}`} strokeDashoffset={-green} strokeLinecap="butt" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#ef4444" strokeWidth="10" strokeDasharray={`${red} ${c - red}`} strokeDashoffset={-(green + amber)} strokeLinecap="butt" />
      <text x="50" y="52" transform="rotate(90 50 50)" textAnchor="middle" className="fill-stone-800" style={{ fontSize: "20px", fontWeight: 700 }}>{pct}%</text>
    </svg>
  );
}
