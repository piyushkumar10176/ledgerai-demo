import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { practiceFeed } from "@/lib/bookkeeping";
import { categoryLabel, type SourceType } from "@/lib/hmrc-categories";
import BookkeepingFeed from "@/components/BookkeepingFeed";
import CopilotButton from "@/components/CopilotButton";

export default async function BookkeepingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const feed = await practiceFeed(session.firmId);

  // Duplicate detection: same client + same amount within 5 days.
  const dupIds = new Set<number>();
  const byKey = new Map<string, typeof feed>();
  for (const t of feed) {
    const k = `${t.client_id}|${t.amount}`;
    const arr = byKey.get(k) ?? [];
    arr.push(t); byKey.set(k, arr);
  }
  for (const arr of byKey.values()) {
    const sorted = [...arr].sort((a, b) => a.txn_date.localeCompare(b.txn_date));
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.abs(new Date(sorted[i].txn_date).getTime() - new Date(sorted[i - 1].txn_date).getTime());
      if (gap <= 5 * 86400000) { dupIds.add(sorted[i].id); dupIds.add(sorted[i - 1].id); }
    }
  }

  const rows = feed.map((t) => ({
    ...t,
    dup: dupIds.has(t.id),
    categoryLabel: t.status === "review" ? "Needs review" : t.category ? categoryLabel(t.source_type as SourceType, t.category) : "Uncategorised",
  }));
  const flagged = rows.filter((r) => r.status === "review").length;
  const dupCount = dupIds.size;
  const auto = rows.filter((r) => r.status === "auto").length;

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <div className="mb-1">
        <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>Bookkeeping</h1>
        <p className="text-[13px] text-[#8a879a]">Bank feeds &amp; AI reconciliation — across the practice</p>
      </div>

      {(flagged > 0 || dupCount > 0) && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl p-4 text-[#efeaff]" style={{ background: "linear-gradient(100deg,#2a2350,#3a2f66)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd48a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" /></svg>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold">AI flagged {flagged} for review{dupCount > 0 ? ` · ${dupCount} possible duplicate${dupCount === 1 ? "" : "s"}` : ""}</div>
            <div className="text-[12px]" style={{ color: "#c4bce6" }}>Low-confidence categorisations and repeated same-amount payments — review before reconciling.</div>
          </div>
          <CopilotButton className="flex-none rounded-lg bg-white/15 px-3.5 py-2 text-[12.5px] font-bold text-white">Review with AI</CopilotButton>
        </div>
      )}

      <div className="mt-4 card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-[#efeff5] px-5 py-3.5">
          <div className="text-[14.5px] font-bold">Practice bank feed</div>
          <span className="text-[11.5px] text-[#8a879a]">all clients · most recent</span>
          <div className="flex-1" />
          <span className="chip" style={{ color: "#12805c", background: "#d3f8e6" }}>{auto} auto-categorised</span>
        </div>
        <BookkeepingFeed rows={rows} />
      </div>
    </main>
  );
}
