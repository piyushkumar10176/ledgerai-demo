"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS: [string, string][] = [
  ["employment_income", "Employment income (P60)"],
  ["employment_tax_paid", "Tax already paid (PAYE)"],
  ["pension_income", "Pension income"],
  ["dividends", "Dividends"],
  ["interest", "Savings interest"],
  ["pension_contributions", "Pension contributions (gross)"],
  ["gift_aid", "Gift Aid (gross)"],
  ["hicbc", "High Income Child Benefit Charge"],
  ["capital_allowances", "Capital allowances"],
  ["disallowables", "Disallowable expenses"],
];

export default function YearEndForm({
  clientId, initial, declared,
}: {
  clientId: number; initial: Record<string, number>; declared: string | null;
}) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map(([k]) => [k, initial[k] ? (initial[k] / 100).toFixed(2) : ""])),
  );
  const [plan, setPlan] = useState(String(initial.student_loan_plan ?? ""));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(declare = false) {
    setBusy(true); setSaved(false);
    await fetch(`/api/year-end/${clientId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, student_loan_plan: plan, declare }),
    });
    setBusy(false); setSaved(true); router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="text-[15px] font-bold">Other income &amp; adjustments (Layer 3)</h2>
      <p className="text-[12px] text-[#8a879a]">Everything outside the business books that the final declaration needs.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, label]) => (
          <label key={k} className="block">
            <span className="text-[11px] font-semibold text-[#8a879a]">{label} (£)</span>
            <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder="0.00" className="input mt-0.5" inputMode="decimal" />
          </label>
        ))}
        <label className="block">
          <span className="text-[11px] font-semibold text-[#8a879a]">Student loan plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input mt-0.5">
            <option value="">None</option>
            <option value="plan1">Plan 1</option><option value="plan2">Plan 2</option>
            <option value="plan4">Plan 4</option><option value="plan5">Plan 5</option>
            <option value="postgrad">Postgraduate</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => save(false)} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        <button onClick={() => save(true)} disabled={busy} className="btn-ghost">Mark final declaration ready</button>
        {saved && <span className="text-[12px] font-bold text-green-600">Saved ✓ — projection updated</span>}
        {declared && <span className="chip bg-green-100 text-green-700">Declared {new Date(declared).toLocaleDateString("en-GB")}</span>}
      </div>
    </div>
  );
}
