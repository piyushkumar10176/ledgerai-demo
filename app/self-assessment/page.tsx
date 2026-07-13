import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { firmObligations } from "@/lib/obligations";
import { mockTaxEstimate } from "@/lib/quarterly-submit";
import { CURRENT_QUARTER } from "@/lib/periods";
import { formatGBP } from "@/lib/money";

const AV = [["#e6f4ff", "#2e90fa"], ["#eef0ff", "#6c5ce7"], ["#fff4e5", "#f79009"], ["#e6f9f0", "#12805c"], ["#fbe8f3", "#c026a3"], ["#f3e8ff", "#8b5cf6"]];
const PILL: Record<string, { color: string; background: string }> = {
  done: { color: "#12805c", background: "#e6f9f0" }, review: { color: "#5546d4", background: "#eef0ff" }, wait: { color: "#b54708", background: "#fef0c7" },
};

export default async function SaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [clients, obligations] = await Promise.all([listClients(session.firmId), firmObligations(session.firmId, CURRENT_QUARTER)]);

  const rows = (await Promise.all(clients.map(async (c) => {
    const services = await getClientServices(c.id);
    if (!services.includes("mtd-itsa")) return null;
    const obs = obligations.filter((o) => o.clientId === c.id);
    const profit = obs.reduce((s, o) => s + (o.netProfit ?? 0), 0);
    let stage: string, status: string, mode: "done" | "review" | "wait", tax: string;
    if (obs.length > 0 && obs.every((o) => o.status === "filed")) { stage = "Filed"; status = "Submitted"; mode = "done"; tax = formatGBP(mockTaxEstimate(profit).estimate); }
    else if (obs.some((o) => o.status === "ready")) { stage = "Draft complete"; status = "AI review"; mode = "review"; tax = formatGBP(mockTaxEstimate(profit).estimate); }
    else { stage = "Awaiting records"; status = "Waiting"; mode = "wait"; tax = "—"; }
    return { id: c.id, name: c.name, stage, status, mode, tax };
  }))).filter(Boolean) as { id: number; name: string; stage: string; status: string; mode: "done" | "review" | "wait"; tax: string }[];

  const filed = rows.filter((r) => r.mode === "done").length;
  const progress = rows.filter((r) => r.mode === "review").length;
  const waiting = rows.filter((r) => r.mode === "wait").length;
  const total = rows.length || 1;
  const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>Self Assessment</h1>
        <p className="text-[13px] text-[#8a879a]">MTD Income Tax · {rows.length} clients this cycle</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Returns filed" value={`${filed} / ${rows.length}`} pct={filed / total} bar="#16b364" />
        <Stat label="In progress" value={String(progress)} pct={progress / total} bar="#7c6cf5" />
        <Stat label="Awaiting client info" value={String(waiting)} pct={waiting / total} bar="#f79009" />
      </div>

      <div className="mt-4 card overflow-hidden">
        <div className="border-b border-[#efeff5] px-5 py-3.5 text-[14.5px] font-bold">Quarterly progress · {CURRENT_QUARTER.label}</div>
        <div className="scroll-x">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[#efeff5] bg-[#fafafd] text-left text-[11px] font-bold uppercase tracking-[.04em] text-[#9995ab]">
                <th className="px-5 py-3">Client</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3 text-right">Est. tax</th><th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const [bg, fg] = AV[i % AV.length];
                return (
                  <tr key={r.id} className="border-b border-[#f4f4f9]">
                    <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[12px] font-bold" style={{ background: bg, color: fg }}>{initials(r.name)}</span><span className="text-[13.5px] font-bold">{r.name}</span></div></td>
                    <td className="px-5 py-3.5 text-[12.5px] font-medium text-[#5a5870]">{r.stage}</td>
                    <td className="mono px-5 py-3.5 text-right text-[13px] font-semibold">{r.tax}</td>
                    <td className="px-5 py-3.5"><div className="flex justify-end"><span className="chip" style={PILL[r.mode]}>{r.status}</span></div></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[#a6a3b6]">No MTD clients yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, pct, bar }: { label: string; value: string; pct: number; bar: string }) {
  return (
    <div className="card p-[18px]">
      <div className="text-[12.5px] font-semibold text-[#8a879a]">{label}</div>
      <div className="mono mt-2 text-[24px] font-extrabold">{value}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "#f0eff7" }}><div className="h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: bar }} /></div>
    </div>
  );
}
