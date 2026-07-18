import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { firmObligations } from "@/lib/obligations";
import { CURRENT_QUARTER, TAX_YEAR, daysUntil } from "@/lib/periods";
import { monthlyCashflow, autoCategorisedCount } from "@/lib/analytics";
import { formatGBP } from "@/lib/money";
import AddClientForm from "@/components/AddClientForm";
import ControlTower from "@/components/ControlTower";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  const fid = session.firmId;

  const [clients, obligations, cashflow, autoN] = await Promise.all([
    listClients(fid), firmObligations(fid, CURRENT_QUARTER), monthlyCashflow(fid), autoCategorisedCount(fid),
  ]);

  const filed = obligations.filter((o) => o.status === "filed").length;
  const ready = obligations.filter((o) => o.status === "ready").length;
  const missing = obligations.filter((o) => o.status === "missing").length;
  const total = obligations.length || 1;
  const exceptions = obligations.reduce((s, o) => s + o.reviewCount, 0);
  const readyProfit = obligations.filter((o) => o.status === "ready").reduce((s, o) => s + (o.netProfit ?? 0), 0);
  const mandated = clients.filter((c) => c.mandation_status === "mandated").length;
  const days = daysUntil(CURRENT_QUARTER.deadline);

  const kpis = [
    { label: "Active clients", value: String(clients.length), icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-.001", ibg: "#eef0ff", ic: "#7c6cf5", delta: `${mandated} mandated`, dtone: "info" },
    { label: "Ready to file", value: formatGBP(readyProfit), icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", ibg: "#fff4e5", ic: "#f79009", delta: `${ready} clients`, dtone: "warn" },
    { label: "Filed this quarter", value: `${filed}/${total}`, icon: "M20 6 9 17l-5-5", ibg: "#e6f9f0", ic: "#16b364", delta: `${Math.round((filed / total) * 100)}%`, dtone: "up" },
    { label: "Open exceptions", value: String(exceptions), icon: "M12 8v4M12 16h.01M12 2 2 22h20z", ibg: "#fee4e2", ic: "#f04438", delta: `${missing} missing`, dtone: "down" },
  ];

  const insights = [
    { tone: "#7dd3fc", tag: "AUTO-CATEGORISED", text: `${autoN} transactions categorised by AI at ≥80% confidence. ${exceptions} need your review.` },
    { tone: "#6ee7b7", tag: "READY TO FILE", text: `${ready} client${ready === 1 ? "" : "s"} reconcile and are ready to submit — ${formatGBP(readyProfit)} of profit for ${CURRENT_QUARTER.label}.` },
    { tone: "#ffb84d", tag: "MISSING DATA", text: `${missing} client${missing === 1 ? "" : "s"} have no data in yet for ${CURRENT_QUARTER.label} — chase before ${CURRENT_QUARTER.deadline}.` },
  ];

  const dueClients = obligations.filter((o) => o.status === "ready").slice(0, 5);
  const attention = obligations.filter((o) => o.status === "missing").slice(0, 4);

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>Practice overview</h1>
          <p className="text-[13px] text-[#8a879a]">MTD Income Tax · {TAX_YEAR} · {CURRENT_QUARTER.label} · deadline {CURRENT_QUARTER.deadline} ({days}d)</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/audit" className="btn-ghost">Audit log</Link>
          <form action="/api/dev/seed-samples" method="post"><button className="btn-ghost">Load sample</button></form>
          <form action="/api/dev/reset" method="post"><button className="btn-ghost">Reset</button></form>
          <AddClientForm />
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-[#8a879a]">{k.label}</span>
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]" style={{ background: k.ibg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={k.ic} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: `<path d="${k.icon}"/>` }} />
              </span>
            </div>
            <div className="mono my-[10px] mb-1 text-[26px] font-extrabold" style={{ letterSpacing: "-.02em" }}>{k.value}</div>
            <div className="text-[12px] font-semibold"><DeltaChip tone={k.dtone} text={k.delta} /></div>
          </div>
        ))}
      </div>

      {/* Cash flow + AI insights */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="card p-5">
          <div className="mb-1.5 flex items-start justify-between">
            <div>
              <div className="text-[15px] font-bold">Cash flow — all clients</div>
              <div className="text-[12px] text-[#8a879a]">This tax year · income vs expenses</div>
            </div>
            <div className="flex items-center gap-4">
              <Legend c="#7c6cf5" label="Income" /><Legend c="#38bdf8" label="Expenses" />
            </div>
          </div>
          <CashChart data={cashflow} />
        </div>

        <div className="rounded-2xl p-5 text-[#e9e6ff]" style={{ background: "linear-gradient(165deg,#1c1938,#26224a)" }}>
          <div className="flex items-center gap-2">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b9a8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.8L18.7 9l-4.8 1.9L12 15.7 10.1 10.9 5.3 9l4.8-1.2z" /></svg>
            <span className="text-[14px] font-bold">AI insights</span>
            <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(124,108,245,.28)", color: "#cbbcff" }}>{insights.length} NEW</span>
          </div>
          <div className="mt-3.5 flex flex-col gap-2.5">
            {insights.map((in_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: in_.tone }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: in_.tone }} />{in_.tag}</div>
                <div className="mt-1.5 text-[12.5px] leading-snug" style={{ color: "#d8d4f0" }}>{in_.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deadlines + attention */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="card p-5">
          <div className="mb-3 text-[15px] font-bold">Ready to file</div>
          <div className="flex flex-col">
            {dueClients.map((o) => (
              <div key={o.sourceId} className="flex items-center gap-3 border-b border-[#f4f4f9] py-2.5 last:border-0">
                <div className="w-11 flex-none rounded-[10px] py-1.5 text-center leading-none" style={{ background: "#fef0c7" }}>
                  <div className="text-[16px] font-extrabold" style={{ color: "#b54708" }}>07</div>
                  <div className="text-[9.5px] font-bold" style={{ color: "#b54708", opacity: .8 }}>AUG</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{o.clientName}</div>
                  <div className="text-[11.5px] text-[#8a879a]">{o.businessName} · {formatGBP(o.netProfit ?? 0)}</div>
                </div>
                <Link href={`/clients/${o.clientId}/sources/${o.sourceId}/file`} className="chip bg-brand-50 text-brand-700 hover:bg-brand-100">File →</Link>
              </div>
            ))}
            {dueClients.length === 0 && <div className="py-6 text-center text-[13px] text-[#a6a3b6]">Nothing waiting to file.</div>}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-bold">Needs attention</div>
            <span className="chip" style={{ color: "#b54708", background: "#fef0c7" }}>AI flagged</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {attention.map((o) => (
              <div key={o.sourceId} className="flex items-start gap-3 rounded-xl border border-[#fde3c8] p-3" style={{ background: "#fffaf2" }}>
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px]" style={{ background: "#fef0c7" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f79009" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold">Missing data — {o.clientName}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-[#77748a]">No transactions in for {o.businessName} this quarter.</div>
                </div>
                <Link href={`/clients/${o.clientId}`} className="flex-none pt-0.5 text-[11.5px] font-bold text-brand-600">Chase</Link>
              </div>
            ))}
            {attention.length === 0 && <div className="py-6 text-center text-[13px] text-[#a6a3b6]">All clients have data in. 🎉</div>}
          </div>
        </div>
      </div>

      {/* Full obligations */}
      <h2 className="mt-8 text-[15px] font-bold">Quarterly obligations · every client × source</h2>
      <div className="mt-3">
        <ControlTower obligations={obligations} period={{ label: CURRENT_QUARTER.label, taxYear: TAX_YEAR, end: CURRENT_QUARTER.periodEnd, due: CURRENT_QUARTER.deadline, daysLeft: days }} />
      </div>
    </main>
  );
}

function DeltaChip({ tone, text }: { tone: string; text: string }) {
  const map: Record<string, string> = {
    up: "color:#12805c;background:#d3f8e6", down: "color:#b42318;background:#fee4e2",
    warn: "color:#b54708;background:#fef0c7", info: "color:#5546d4;background:#eef0ff",
  };
  const [color, bg] = map[tone].split(";").map((s) => s.split(":")[1]);
  return <span className="rounded-full px-2 py-0.5" style={{ color, background: bg }}>{text}</span>;
}
function Legend({ c, label }: { c: string; label: string }) {
  return <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#6b6a76]"><span className="h-2 w-2 rounded-[3px]" style={{ background: c }} />{label}</span>;
}

// Real cash-flow area+line chart from monthly data.
function CashChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  if (data.length === 0) return <div className="py-16 text-center text-[13px] text-[#a6a3b6]">No transactions yet — import a bank statement to see cash flow.</div>;
  const W = 640, H = 220, pad = 34;
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const n = data.length;
  const x = (i: number) => pad + (n === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = (key: "income" | "expense") => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(d[key])}`).join(" ");
  const area = `${line("income")} L${x(n - 1)} ${H - pad} L${x(0)} ${H - pad} Z`;
  const fmtMonth = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short" });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full">
      <defs><linearGradient id="inc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c6cf5" stopOpacity=".28" /><stop offset="1" stopColor="#7c6cf5" stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={pad} y1={pad + f * (H - 2 * pad)} x2={W - pad} y2={pad + f * (H - 2 * pad)} stroke="#f0f0f6" />)}
      {n > 1 && <path d={area} fill="url(#inc)" />}
      <path d={line("income")} fill="none" stroke="#7c6cf5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={line("expense")} fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.income)} r="3.5" fill="#7c6cf5" stroke="#fff" strokeWidth="1.5" />)}
      {data.map((d, i) => <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="mono" fontSize="10" fill="#b0adc0">{fmtMonth(d.month)}</text>)}
    </svg>
  );
}
