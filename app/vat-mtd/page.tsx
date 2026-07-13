import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { firmObligations } from "@/lib/obligations";
import { CURRENT_QUARTER, TAX_YEAR, daysUntil } from "@/lib/periods";
import { hmrcConnectivity, getAgentConnection } from "@/lib/hmrc";
import ControlTower from "@/components/ControlTower";

export default async function VatMtdPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [obligations, check, conn] = await Promise.all([
    firmObligations(session.firmId, CURRENT_QUARTER),
    hmrcConnectivity(),
    getAgentConnection(session.firmId),
  ]);
  const days = daysUntil(CURRENT_QUARTER.deadline);

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>VAT &amp; Making Tax Digital</h1>
        <p className="text-[13px] text-[#8a879a]">Quarterly obligations across the practice · {TAX_YEAR}</p>
      </div>

      {/* HMRC connection status */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4 text-white" style={{ background: "linear-gradient(120deg,#1c1938,#2a2350)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b9a8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><path d="M12 2 2 8h20z" /></svg>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold">HMRC {conn ? "connected" : check.helloOk ? "sandbox live · agent not connected" : "sandbox"}</div>
          <div className="text-[12px]" style={{ color: "#c4bce6" }}>
            {conn ? "Real MTD submissions enabled." : check.helloOk ? "Hello World API reachable — connect an agent to file real VAT/ITSA." : check.helloMessage}
          </div>
        </div>
        <Link href="/hmrc" className="flex-none rounded-lg bg-white/15 px-3.5 py-2 text-[12.5px] font-bold text-white">Manage HMRC →</Link>
      </div>

      <ControlTower obligations={obligations} period={{ label: CURRENT_QUARTER.label, taxYear: TAX_YEAR, end: CURRENT_QUARTER.periodEnd, due: CURRENT_QUARTER.deadline, daysLeft: days }} />
    </main>
  );
}
