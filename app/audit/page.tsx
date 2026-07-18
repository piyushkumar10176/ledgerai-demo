import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAudit } from "@/lib/audit";

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const rows = await listAudit(session.firmId);

  return (
    <main className="fade-up mx-auto max-w-[1000px] px-4 py-6 sm:px-7">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold" style={{ letterSpacing: "-.02em" }}>Audit log</h1>
        <p className="text-[13px] text-[#8a879a]">Every change, append-only — for compliance &amp; HMRC explainability</p>
      </div>
      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#efeff5] bg-[#fafafd] text-left text-[11px] font-bold uppercase tracking-[.04em] text-[#9995ab]">
                <th className="px-5 py-3">When</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Entity</th><th className="px-5 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f4f4f9]">
                  <td className="mono px-5 py-2.5 text-[11.5px] text-[#9995ab]">{r.created_at}</td>
                  <td className="px-5 py-2.5"><span className="chip bg-brand-50 text-brand-700">{r.action}</span></td>
                  <td className="px-5 py-2.5 text-[12.5px] text-[#5a5870]">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</td>
                  <td className="px-5 py-2.5 text-[12.5px] text-[#5a5870]">{r.detail ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[#a6a3b6]">No events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
