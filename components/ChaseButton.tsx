"use client";

import { useState } from "react";

// Records a real (escalating) chase; delivery is mocked. Shows the stage.
export default function ChaseButton({
  clientId, periodKey = "2026Q1", className, style,
}: {
  clientId: number; periodKey?: string; className?: string; style?: React.CSSProperties;
}) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function chase() {
    setBusy(true);
    const res = await fetch("/api/chase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, periodKey }) });
    const j = await res.json();
    setBusy(false);
    if (res.ok) setSent(j.label);
  }

  if (sent) return <span className="text-[11.5px] font-bold text-green-600">{sent} sent ✓</span>;
  return (
    <button onClick={chase} disabled={busy} className={className ?? "rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"} style={style}>
      {busy ? "…" : "Chase"}
    </button>
  );
}
