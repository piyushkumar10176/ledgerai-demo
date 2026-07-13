import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Nav() {
  const session = await getSession();
  if (!session) return null;
  const links = [
    { href: "/dashboard", label: "Control tower" },
    { href: "/review", label: "Review queue" },
    { href: "/mandation", label: "Mandation" },
  ];
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold tracking-tight">
            Ledger<span className="text-indigo-600">AI</span>{" "}
            <span className="text-xs font-normal text-slate-400">UK · MTD IT · demo</span>
          </Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-slate-600 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{session.name}</span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-md border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-50">
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
