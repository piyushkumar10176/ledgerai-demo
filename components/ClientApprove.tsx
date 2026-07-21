"use client";

import { useState } from "react";

// Client-side sign-off on the quarter's figures, via magic link (no login).
export default function ClientApprove({ token, periodKey, approved }: { token: string; periodKey: string; approved: boolean }) {
  const [done, setDone] = useState(approved);
  const [busy, setBusy] = useState(false);

  if (done)
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center text-[13px] font-semibold text-green-800">
        ✓ Approved — thank you. Your accountant can now file this quarter.
      </div>
    );

  return (
    <button
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/link/${token}/approve`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodKey }),
        });
        setBusy(false);
        if (res.ok) setDone(true);
      }}
      disabled={busy}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {busy ? "Sending…" : `✓ Approve my ${periodKey} figures`}
    </button>
  );
}
