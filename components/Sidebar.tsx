"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Control tower", icon: "🗼" },
  { href: "/review", label: "Review queue", icon: "🔎" },
  { href: "/mandation", label: "Mandation", icon: "✅" },
  { href: "/hmrc", label: "HMRC", icon: "🏛️" },
];

export default function Sidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/clients")
      : pathname.startsWith(href);

  const panel = (
    <div className="flex h-full flex-col bg-ink-900 px-3 py-5">
      <Link href="/dashboard" onClick={() => setOpen(false)} className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white">L</span>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">LedgerAI <span className="text-brand-300">UK</span></div>
          <div className="text-[10px] uppercase tracking-widest text-stone-400">MTD · demo</div>
        </div>
      </Link>
      <nav className="flex-1 space-y-1">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
            className={"side-link " + (isActive(n.href) ? "side-link-active" : "")}>
            <span className="text-base">{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 rounded-xl bg-white/5 p-3">
        <div className="text-xs font-medium text-white">{name}</div>
        <div className="text-[11px] text-stone-400">Demo Accountants</div>
        <form action="/api/auth/logout" method="post" className="mt-2">
          <button className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5 hover:text-white">
            Log out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">L</span>
          <span className="text-sm font-bold">LedgerAI <span className="text-brand-600">UK</span></span>
        </Link>
        <button onClick={() => setOpen(true)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm">☰ Menu</button>
      </div>

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">{panel}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{panel}</div>
        </div>
      )}
    </>
  );
}
