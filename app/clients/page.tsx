import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listClients, listIncomeSources } from "@/lib/data";
import { getClientServices } from "@/lib/services";
import { firmObligations } from "@/lib/obligations";
import { CURRENT_QUARTER } from "@/lib/periods";
import AddClientForm from "@/components/AddClientForm";
import ImportClients from "@/components/ImportClients";

const AV = [
  ["#eef0ff", "#6c5ce7"], ["#fff4e5", "#f79009"], ["#e6f9f0", "#12805c"],
  ["#fbe8f3", "#c026a3"], ["#e6f4ff", "#2e90fa"], ["#f3e8ff", "#8b5cf6"], ["#fff1e6", "#e57d5b"],
];
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }
function ref(name: string, id: number) { return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() + "-" + String(id).padStart(4, "0"); }

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const tab = (await searchParams).tab ?? "all";

  const [clients, obligations] = await Promise.all([
    listClients(session.firmId),
    firmObligations(session.firmId, CURRENT_QUARTER),
  ]);

  const rows = await Promise.all(clients.map(async (c) => {
    const obs = obligations.filter((o) => o.clientId === c.id);
    const services = await getClientServices(c.id);
    const sources = await listIncomeSources(c.id);
    const exceptions = obs.reduce((s, o) => s + o.reviewCount, 0);
    const anyMissing = obs.some((o) => o.status === "missing") || obs.length === 0;
    const anyReady = obs.some((o) => o.status === "ready");
    const allFiled = obs.length > 0 && obs.every((o) => o.status === "filed");

    let ai: { text: string; mode: "ok" | "warn" | "info" };
    let health: string;
    if (anyMissing) { ai = { text: "Needs data", mode: "warn" }; health = "#f04438"; }
    else if (exceptions > 0) { ai = { text: `${exceptions} flag${exceptions === 1 ? "" : "s"}`, mode: "warn" }; health = "#f79009"; }
    else if (allFiled) { ai = { text: "Filed", mode: "ok" }; health = "#16b364"; }
    else if (anyReady) { ai = { text: "Ready to file", mode: "info" }; health = "#f79009"; }
    else { ai = { text: "Categorising", mode: "info" }; health = "#16b364"; }

    const type = sources.length === 0 ? "—" : sources.length > 1 ? "Multiple" : sources[0].type === "self-employment" ? "Sole trader" : "Landlord";
    return {
      id: c.id, name: c.name, ref: ref(c.name, c.id), type,
      scheme: services.includes("vat") ? "Standard" : "—",
      deadline: services.includes("mtd-itsa") ? CURRENT_QUARTER.deadline : "—",
      mandation: c.mandation_status, exceptions, anyMissing, anyReady, ai, health,
    };
  }));

  const filtered = rows.filter((r) =>
    tab === "attention" ? (r.anyMissing || r.exceptions > 0)
      : tab === "ready" ? r.anyReady
        : tab === "vat" ? r.scheme !== "—"
          : true);

  const tabs = [
    { id: "all", label: `All ${rows.length}` },
    { id: "attention", label: "Needs attention" },
    { id: "ready", label: "Ready to file" },
    { id: "vat", label: "VAT" },
  ];
  const aiChip: Record<string, { color: string; background: string }> = {
    ok: { color: "#12805c", background: "#e6f9f0" },
    warn: { color: "#b54708", background: "#fef0c7" },
    info: { color: "#5546d4", background: "#eef0ff" },
  };

  return (
    <main className="fade-up mx-auto max-w-[1240px] px-4 py-6 sm:px-7">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-[#e9e9f1] bg-white p-1">
          {tabs.map((t) => (
            <Link key={t.id} href={`/clients?tab=${t.id}`}
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition"
              style={t.id === tab ? { background: "#6c5ce7", color: "#fff" } : { color: "#6b6a76" }}>{t.label}</Link>
          ))}
        </div>
        <div className="flex-1" />
        <ImportClients />
        <AddClientForm />
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-[#efeff5] bg-[#fafafd] text-left text-[11px] font-bold uppercase tracking-[.04em] text-[#9995ab]">
                <th className="px-5 py-3">Client</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">VAT scheme</th>
                <th className="px-5 py-3">Next deadline</th><th className="px-5 py-3">AI status</th><th className="px-5 py-3 text-right">Health</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const [bg, fg] = AV[i % AV.length];
                return (
                  <tr key={r.id} className="border-b border-[#f4f4f9] transition hover:bg-[#fafafd]">
                    <td className="px-5 py-3.5">
                      <Link href={`/clients/${r.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[13px] font-bold" style={{ background: bg, color: fg }}>{initials(r.name)}</span>
                        <span className="min-w-0"><span className="block truncate text-[13.5px] font-bold text-[#16151c]">{r.name}</span><span className="mono block text-[11px] text-[#9995ab]">{r.ref}</span></span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] font-medium text-[#5a5870]">{r.type}</td>
                    <td className="px-5 py-3.5 text-[12.5px] font-medium text-[#5a5870]">{r.scheme}</td>
                    <td className="px-5 py-3.5 text-[12.5px] font-semibold text-[#5a5870]">{r.deadline}</td>
                    <td className="px-5 py-3.5"><span className="chip" style={aiChip[r.ai.mode]}>{r.ai.text}</span></td>
                    <td className="px-5 py-3.5"><div className="flex justify-end"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.health }} /></div></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[#a6a3b6]">No clients in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
