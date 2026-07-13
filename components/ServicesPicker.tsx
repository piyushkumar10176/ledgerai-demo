"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Def { key: string; label: string; desc: string; emoji: string; chip: string }

export default function ServicesPicker({
  clientId, all, selected,
}: {
  clientId: number; all: Def[]; selected: string[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string[]>(selected);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(k: string) {
    setSaved(false);
    setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  }

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}/services`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services: chosen }),
    });
    setBusy(false);
    if (res.ok) { setSaved(true); router.refresh(); }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {all.map((s) => {
          const on = chosen.includes(s.key);
          return (
            <button key={s.key} onClick={() => toggle(s.key)}
              className={"flex items-center gap-3 rounded-2xl border p-4 text-left transition " +
                (on ? "border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:bg-slate-50")}>
              <span className={"flex h-10 w-10 items-center justify-center rounded-xl text-lg " + s.chip}>{s.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{s.label}</div>
                <div className="text-xs text-slate-500">{s.desc}</div>
              </div>
              <span className={"flex h-5 w-5 items-center justify-center rounded-full border text-xs " +
                (on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent")}>✓</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? "Saving…" : "Save services"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved ✓ — only these tabs now show.</span>}
      </div>
    </div>
  );
}
