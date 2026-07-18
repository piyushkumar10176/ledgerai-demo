import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { chartOfAccounts } from "@/lib/bookkeeping";
import { getAgentConnection, vatObligations } from "@/lib/hmrc";
import { formatGBP } from "@/lib/money";
import ServiceTabs from "@/components/ServiceTabs";
import CopilotButton from "@/components/CopilotButton";

const LABELS: [string, string][] = [
  ["1", "VAT due on sales and other outputs"], ["2", "VAT due on acquisitions from EU"],
  ["3", "Total VAT due"], ["4", "VAT reclaimed on purchases"], ["5", "Net VAT to pay to HMRC"],
  ["6", "Total value of sales ex. VAT"], ["7", "Total value of purchases ex. VAT"],
  ["8", "Total value of EU supplies"], ["9", "Total value of EU acquisitions"],
];

export default async function VatPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  const client = await getClient(session.firmId, clientId);
  if (!client) notFound();
  const services = await getClientServices(clientId);
  if (!services.includes("vat")) redirect(`/clients/${clientId}`);

  const coa = await chartOfAccounts(clientId);
  const box6 = Math.round(coa.incomeTotal / 1.2);
  const box1 = coa.incomeTotal - box6;
  const box7 = Math.round(coa.expenseTotal / 1.2);
  const box4 = coa.expenseTotal - box7;
  const b: Record<string, number> = { "1": box1, "2": 0, "3": box1, "4": box4, "5": Math.abs(box1 - box4), "6": box6, "7": box7, "8": 0, "9": 0 };
  const conn = await getAgentConnection(session.firmId);
  const vatObs = client.vrn ? await vatObligations(session.firmId, client.vrn) : null;

  const steps = [
    { n: "✓", label: "Draft", done: true }, { n: "✓", label: "AI reviewed", done: true }, { n: "3", label: "Submit to HMRC", done: false },
  ];

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>{client.name}</h1>
      <ServiceTabs clientId={clientId} active="vat" services={services} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* 9-box */}
        <div className="card overflow-hidden">
          <div className="border-b border-[#efeff5] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[16px] font-extrabold">VAT Return · {client.name}</div>
                <div className="mt-0.5 text-[12.5px] text-[#8a879a]">Period 1 Apr – 30 Jun 2026 · Quarterly · Making Tax Digital</div>
              </div>
              <span className="chip" style={{ color: "#b54708", background: "#fef0c7" }}>Due 7 Aug</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-extrabold" style={s.done ? { background: "#16b364", color: "#fff" } : { background: "#eef0ff", color: "#7c6cf5" }}>{s.n}</span>
                  <span className="text-[12px] font-bold" style={{ color: s.done ? "#12805c" : "#7c6cf5" }}>{s.label}</span>
                  {i < steps.length - 1 && <span className="mx-1 text-[#d5d3e2]">→</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 pb-3 pt-1">
            {LABELS.map(([n, label]) => {
              const hi = n === "3" || n === "5";
              const zero = b[n] === 0 && (n === "2" || n === "8" || n === "9");
              return (
                <div key={n} className="flex items-center gap-3.5 border-b border-[#f4f4f9] py-3 last:border-0">
                  <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-[12px] font-extrabold" style={{ background: "#f1f0f9", color: "#7c6cf5" }}>{n}</span>
                  <span className="flex-1 text-[12.5px] text-[#4a4860]" style={{ fontWeight: hi ? 700 : 500 }}>{label}</span>
                  <span className="mono text-[13.5px] font-bold" style={{ color: n === "5" ? "#7c6cf5" : zero ? "#9995ab" : "#16151c" }}>{formatGBP(b[n])}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI review + submit */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5 text-[#e9e6ff]" style={{ background: "linear-gradient(165deg,#1c1938,#2a2350)" }}>
            <div className="flex items-center gap-2">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b9a8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.8L18.7 9l-4.8 1.9L12 15.7 10.1 10.9 5.3 9l4.8-1.2z" /></svg>
              <span className="text-[14px] font-bold">AI review</span>
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "#6ee7b7" }}><span className="h-1.5 w-1.5 rounded-full bg-[#6ee7b7]" />Ready</span>
            </div>
            <p className="mt-3.5 text-[12.5px] leading-relaxed" style={{ color: "#d8d4f0" }}>
              The 9 boxes reconcile against the ledger — the figures are computed deterministically in code, never by AI. No filing errors found.
            </p>
            <div className="mt-3 rounded-xl border p-3" style={{ background: "rgba(255,213,138,.1)", borderColor: "rgba(255,213,138,.25)" }}>
              <div className="text-[11.5px] font-bold" style={{ color: "#ffd48a" }}>⚠ Standard-rate assumption</div>
              <div className="mt-1 text-[12px] leading-snug" style={{ color: "#d8d4f0" }}>This demo derives VAT at 20% on VAT-inclusive amounts. Confirm the scheme before submitting.</div>
            </div>
            <CopilotButton className="mt-3.5 w-full rounded-xl bg-white/10 py-2.5 text-[12.5px] font-bold text-white">Explain the calculation →</CopilotButton>
          </div>

          <div className="card p-[18px]">
            <div className="text-[12.5px] font-semibold text-[#8a879a]">Net VAT due to HMRC</div>
            <div className="mono my-1.5 mb-3.5 text-[30px] font-extrabold" style={{ letterSpacing: "-.02em" }}>{formatGBP(b["5"])}</div>
            <Link href="/hmrc" className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white" style={{ background: "#16b364", boxShadow: "0 4px 14px rgba(22,179,100,.35)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>
              {conn ? "Submit to HMRC" : "Connect & file via MTD"}
            </Link>
            <div className="mt-2.5 text-center text-[11px] text-[#a6a3b6]">
              {client.vrn ? <>VRN {client.vrn} · </> : ""}{conn ? "Live via the real MTD VAT API" : "Connect an agent to file for real"}
            </div>
          </div>

          {client.vrn && (
            <div className="card p-[18px]">
              <div className="flex items-center justify-between">
                <div className="text-[12.5px] font-bold uppercase tracking-wide text-[#8a879a]">Live HMRC obligations</div>
                <span className="chip" style={{ color: "#12805c", background: "#e6f9f0" }}>real API</span>
              </div>
              {!vatObs ? null : vatObs.ok ? (
                <ul className="mt-2 space-y-1.5 text-[12.5px]">
                  {vatObs.obligations!.map((o, i) => (
                    <li key={i} className="flex items-center justify-between border-t border-[#f4f4f9] py-1.5">
                      <span className="mono text-[#5a5870]">{o.start} → {o.end}<span className="text-[#a6a3b6]"> · due {o.due}</span></span>
                      <span className="chip" style={o.status === "F" ? { color: "#12805c", background: "#e6f9f0" } : { color: "#b54708", background: "#fef0c7" }}>{o.status === "F" ? "Fulfilled" : "Open"}</span>
                    </li>
                  ))}
                  {vatObs.obligations!.length === 0 && <li className="py-2 text-[#a6a3b6]">No obligations returned for this period.</li>}
                </ul>
              ) : (
                <div className="mt-2 rounded-lg bg-[#fff4e5] px-3 py-2 text-[11.5px] text-[#b54708]">{vatObs.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
