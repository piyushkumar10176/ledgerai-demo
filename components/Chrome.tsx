"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppTour from "@/components/AppTour";

// Icons (stroke) matching the design handoff.
function I({ d, s = 2, size = 19, color = "currentColor" }: { d: string; s?: number; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  );
}
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  books: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  invoices: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
  vat: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  sa: '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><path d="M12 2 2 8h20z"/>',
  spark: '<path d="M12 3l1.9 4.8L18.7 9l-4.8 1.9L12 15.7 10.1 10.9 5.3 9l4.8-1.2z"/>',
};

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: ICONS.dashboard, badge: "", match: (p: string) => p === "/dashboard" },
  { href: "/clients", label: "Clients", icon: ICONS.clients, badge: "clients", match: (p: string) => p.startsWith("/clients") },
  { href: "/mandation", label: "Mandation", icon: ICONS.spark, badge: "", match: (p: string) => p.startsWith("/mandation") },
  { href: "/review", label: "Review queue", icon: ICONS.books, badge: "review", match: (p: string) => p.startsWith("/review") },
  { href: "/bookkeeping", label: "Bookkeeping", icon: ICONS.books, badge: "", match: (p: string) => p.startsWith("/bookkeeping") },
  { href: "/invoicing", label: "Invoicing", icon: ICONS.invoices, badge: "", match: (p: string) => p.startsWith("/invoicing") },
  { href: "/vat-mtd", label: "VAT & MTD", icon: ICONS.vat, badge: "vat", match: (p: string) => p.startsWith("/vat-mtd") || p.startsWith("/hmrc") },
  { href: "/self-assessment", label: "Self Assessment", icon: ICONS.sa, badge: "", match: (p: string) => p.startsWith("/self-assessment") },
];

export default function Chrome({ name, badges = {}, children }: { name: string; badges?: Record<string, number>; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ai, setAi] = useState(false);

  useEffect(() => {
    const open = () => setAi(true);
    window.addEventListener("ledgerai:copilot", open);
    return () => window.removeEventListener("ledgerai:copilot", open);
  }, []);

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const SidebarInner = (
    <div className="flex h-full flex-col" style={{ background: "linear-gradient(180deg,#171531 0%,#12101f 100%)", color: "#cfcde4" }}>
      <div className="flex h-[68px] items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(135deg,#7c6cf5,#a78bfa)", boxShadow: "0 4px 14px rgba(124,108,245,.5)" }}>
          <I d='<path d="M3 3v18h18"/><path d="m7 14 3-4 3 3 4-6"/>' s={2.4} size={19} color="#fff" />
        </div>
        {!collapsed && (
          <div className="leading-none">
            <div className="text-base font-extrabold text-white" style={{ letterSpacing: "-.02em" }}>LedgerAI</div>
            <div className="text-[10px] font-semibold" style={{ color: "#8a86b8", letterSpacing: ".12em" }}>UK · PRACTICE</div>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {!collapsed && <div className="px-2 pb-1.5 pt-2.5 text-[10px] font-bold tracking-[.14em]" style={{ color: "#6d699a" }}>WORKSPACE</div>}
        {NAV.map((n) => {
          const active = n.match(pathname);
          return (
            <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)} title={n.label}
              data-tour={"nav-" + n.href.slice(1)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all"
              style={active
                ? { background: "linear-gradient(100deg,rgba(124,108,245,.9),rgba(124,108,245,.55))", color: "#fff", boxShadow: "0 4px 12px rgba(124,108,245,.35)" }
                : { color: "#a5a1c8" }}>
              <span className="flex flex-none"><I d={n.icon} size={19} color={active ? "#fff" : "#8a86b8"} /></span>
              {!collapsed && <span className="flex-1">{n.label}</span>}
              {!collapsed && n.badge && (badges[n.badge] ?? 0) > 0 && (
                <span className="flex-none rounded-full px-1.5 py-px text-[10px] font-extrabold" style={active ? { background: "rgba(255,255,255,.25)", color: "#fff" } : { background: "#f04438", color: "#fff" }}>{badges[n.badge]}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <button onClick={() => { setAi(true); setMobileOpen(false); }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold"
          style={{ background: "linear-gradient(120deg,rgba(124,108,245,.22),rgba(56,189,248,.16))", color: "#e7e4ff", boxShadow: "inset 0 0 0 1px rgba(124,108,245,.35)" }}>
          <I d={ICONS.spark} size={18} color="#b9a8ff" />{!collapsed && <span>Ask Copilot</span>}
        </button>
        <div className="flex items-center gap-2.5 px-2 pb-1 pt-3">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#f0a868,#e57d5b)" }}>{initials}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-bold text-white">{name}</div>
              <div className="text-[10.5px]" style={{ color: "#8a86b8" }}>Practice Manager</div>
            </div>
          )}
          {!collapsed && (
            <form action="/api/auth/logout" method="post">
              <button title="Log out" className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/5">Exit</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "#f5f5fa" }}>
      {/* Desktop sidebar */}
      <aside className="hidden flex-none transition-all duration-200 lg:block" style={{ width: collapsed ? 78 : 248 }}>{SidebarInner}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{SidebarInner}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] flex-none items-center gap-3 border-b border-[#ececf3] px-4 sm:px-6" style={{ background: "rgba(255,255,255,.82)", backdropFilter: "blur(10px)" }}>
          <button onClick={() => { setCollapsed((v) => !v); setMobileOpen((v) => !v); }} className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] border border-[#e6e6ee] bg-white text-[#5a5870]">
            <I d='<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>' size={17} />
          </button>
          <div className="hidden items-center gap-2.5 rounded-[11px] border border-[#e9e9f1] bg-white px-3.5 text-[#9d9ab0] md:flex" style={{ height: 40, width: "min(320px,30vw)" }}>
            <I d='<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>' size={16} />
            <span className="text-[13px]">Search clients…</span>
            <span className="ml-auto rounded-[5px] border border-[#e9e9f1] px-1.5 py-0.5 text-[10px] font-semibold text-[#b3b0c4]">⌘K</span>
          </div>
          <div className="flex-1" />
          <button title="Take the tour" aria-label="Take the product tour"
            onClick={() => window.dispatchEvent(new Event("ledgerai:tour"))}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] border border-[#e9e9f1] bg-white text-[15px] font-bold text-[#7c6cf5] hover:bg-[#f6f5ff]">
            ?
          </button>
          <button className="relative flex h-10 w-10 flex-none items-center justify-center rounded-[11px] border border-[#e9e9f1] bg-white text-[#5a5870]">
            <I d='<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' size={18} />
            <span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full border-2 border-white bg-[#f04438]" />
          </button>
          <button data-tour="copilot" onClick={() => setAi(true)} className="flex h-10 flex-none items-center gap-2 rounded-[11px] px-4 text-[13px] font-bold text-white" style={{ background: "linear-gradient(120deg,#7c6cf5,#9b6cf5)", boxShadow: "0 4px 14px rgba(124,108,245,.4)" }}>
            <I d={ICONS.spark} size={16} color="#fff" /> Copilot
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      {ai && <Copilot onClose={() => setAi(false)} />}
      <AppTour />
    </div>
  );
}

function Copilot({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; html: string }[]>([
    { role: "ai", html: "Morning 👋 I've reviewed the practice overnight. Q1 quarterly updates reconcile cleanly. Anything you'd like me to dig into?" },
  ]);
  const [input, setInput] = useState("");

  function reply(t: string) {
    const s = t.toLowerCase();
    if (s.includes("vat")) return "The VAT figures come straight from the deterministic engine — no AI touches a tax number. I can walk you through the 9-box, or file it via MTD once you approve.";
    if (s.includes("review") || s.includes("exception")) return "There are a handful of low-confidence items in the cross-client review queue. Want me to bulk-accept the high-confidence ones and surface only the genuinely ambiguous ones?";
    if (s.includes("chase") || s.includes("missing")) return "A few clients still have no data in for the quarter. I've drafted magic-link reminders for each — reply 'send' and I'll queue them.";
    if (s.includes("quarter") || s.includes("file")) return "Cumulative quarterly updates are ready for the clients with data. I can bulk-file everyone that's 'ready to file' from the control tower.";
    return "I've looked across the practice ledger. Everything reconciles — want me to break it down by client or export a summary?";
  }
  function send(text: string) {
    text = text.trim(); if (!text) return;
    setMessages((m) => [...m, { role: "user", html: text.replace(/</g, "&lt;") }, { role: "ai", html: reply(text) }]);
    setInput("");
  }
  const prompts = ["Explain the VAT return", "Clear the review queue", "Chase missing data"];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" style={{ background: "rgba(16,14,28,.4)", backdropFilter: "blur(2px)" }} />
      <aside className="fixed inset-y-0 right-0 z-50 flex flex-col" style={{ width: "min(420px,92vw)", background: "#fbfbfe", boxShadow: "-16px 0 50px rgba(16,14,28,.24)", animation: "slideIn .28s cubic-bezier(.4,0,.2,1)" }}>
        <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: "linear-gradient(120deg,#1c1938,#2a2350)" }}>
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px]" style={{ background: "linear-gradient(135deg,#7c6cf5,#a78bfa)" }}><I d={ICONS.spark} size={18} color="#fff" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[15px] font-extrabold">LedgerAI Copilot
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">MOCK</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#b9b4d8" }}>Scripted demo replies — not connected to a model or the ledger yet</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white/10 text-white">✕</button>
        </div>
        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={m.role === "user" ? "max-w-[82%] rounded-[16px_16px_4px_16px] px-3.5 py-2.5 text-[13px] leading-relaxed text-white" : "max-w-[88%] rounded-[16px_16px_16px_4px] border border-[#ececf3] bg-white px-3.5 py-3 text-[13px] leading-relaxed text-[#2a2838]"}
                style={m.role === "user" ? { background: "linear-gradient(135deg,#7c6cf5,#9b6cf5)", boxShadow: "0 3px 10px rgba(124,108,245,.28)" } : { boxShadow: "0 1px 3px rgba(20,18,45,.05)" }}
                dangerouslySetInnerHTML={{ __html: m.html }} />
            </div>
          ))}
        </div>
        <div className="border-t border-[#ececf3] bg-white px-4 pb-4 pt-3">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {prompts.map((p) => <button key={p} onClick={() => send(p)} className="rounded-full border border-[#e5e1f6] bg-[#f0eef9] px-3 py-1.5 text-[11.5px] font-semibold text-[#5546d4]">{p}</button>)}
          </div>
          <div className="flex items-center gap-2 rounded-[13px] border border-[#e2e0ee] bg-white py-1.5 pl-4 pr-1.5">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Ask about the practice…" className="flex-1 bg-transparent text-[13.5px] outline-none" />
            <button onClick={() => send(input)} className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-white" style={{ background: "linear-gradient(135deg,#7c6cf5,#9b6cf5)" }}><I d='<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>' size={16} color="#fff" /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
