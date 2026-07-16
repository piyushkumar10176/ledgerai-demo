"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Guided product tour: a spotlight overlay that walks new users through the
// six-stage workflow, navigating between pages as it goes. Steps anchor to
// [data-tour="…"] elements when present and fall back to a centred card.
// Auto-opens once (localStorage flag); relaunch via the "?" topbar button,
// which fires the "ledgerai:tour" window event.

interface TourStep {
  route?: string; // navigate here before showing the step
  target?: string; // data-tour id to spotlight (fallback: centred)
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    route: "/dashboard",
    title: "Welcome to LedgerAI UK 👋",
    body: "Your MTD Income Tax cockpit: see who's mandated, collect client data with zero client logins, review AI-categorised records, and file quarterly updates — all from one place. This 60-second tour shows you around.",
  },
  {
    route: "/dashboard",
    title: "Your practice at a glance",
    body: "The dashboard is the control tower: KPIs, live cash-flow, upcoming quarterly deadlines and a needs-attention list across every client — so \"who's not filed?\" is a ten-second question.",
  },
  {
    route: "/dashboard",
    target: "nav-mandation",
    title: "The mandation checker — real law",
    body: "This runs the actual SI 2026/336 rules: gross qualifying income, exemptions, deferrals and waves, verified by a 27-case legal test suite. Every verdict carries the legal reasons behind it.",
  },
  {
    route: "/mandation",
    target: "book-import",
    title: "Import your client book",
    body: "Upload clients.csv (and optionally income.csv) straight from a messy Excel export — £-formatted amounts, % shares and spaced NINOs are all fine. Problem rows get line-numbered errors, never silent guesses. Every client is assessed the moment it lands.",
  },
  {
    route: "/mandation",
    target: "mandation-table",
    title: "Who's caught — and why",
    body: "Status, wave and mandated-from date per client. Expand \"reasons\" on any row to see the legal trail — the explanation you can put in front of the client.",
  },
  {
    route: "/review",
    title: "The exception queue",
    body: "AI categorises bank lines into HMRC categories with a confidence score. High-confidence lines auto-apply; only the uncertain ones surface here for fast bulk confirm/override — across all clients at once.",
  },
  {
    route: "/hmrc",
    title: "Real HMRC sandbox",
    body: "Live application tokens, an agent OAuth journey (CSRF-protected), and statutory fraud-prevention headers. Quarterly submissions are still mocked — clearly badged — until the ITSA APIs are unlocked on the Developer Hub.",
  },
  {
    route: "/dashboard",
    target: "copilot",
    title: "Copilot — mock for now",
    body: "Scripted demo replies today; the production plan wires it to the ledger with logged, auditable AI decisions. That's the tour! Replay it anytime from the ? button up here.",
  },
];

const DONE_KEY = "ledgerai.tour.v1";

interface Rect { top: number; left: number; width: number; height: number }

export default function AppTour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const findTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-start once, on the dashboard, if never completed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DONE_KEY)) return;
    if (!pathname.startsWith("/dashboard")) return;
    const t = setTimeout(() => setStep((s) => (s === null ? 0 : s)), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Relaunch hook for the "?" button.
  useEffect(() => {
    const open = () => setStep(0);
    window.addEventListener("ledgerai:tour", open);
    return () => window.removeEventListener("ledgerai:tour", open);
  }, []);

  const finish = useCallback(() => {
    localStorage.setItem(DONE_KEY, "done");
    setStep(null);
    setRect(null);
  }, []);

  // Navigate + locate the step's target (retry while the page streams in).
  useEffect(() => {
    if (step === null) return;
    const s = STEPS[step];
    if (s.route && pathname !== s.route) {
      router.push(s.route);
      return; // effect re-runs when pathname changes
    }
    setRect(null);
    if (!s.target) return;

    let tries = 0;
    if (findTimer.current) clearInterval(findTimer.current);
    findTimer.current = setInterval(() => {
      tries++;
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
      const r = el?.getBoundingClientRect();
      if (r && r.width > 4 && r.height > 4) {
        el!.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        clearInterval(findTimer.current!);
      } else if (tries > 16) {
        clearInterval(findTimer.current!); // hidden/missing → centred card
      }
    }, 120);
    return () => { if (findTimer.current) clearInterval(findTimer.current); };
  }, [step, pathname, router]);

  // Keyboard: → / Enter = next, ← = back, Esc = close.
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter")
        setStep((v) => (v !== null && v < STEPS.length - 1 ? v + 1 : (finish(), null)));
      else if (e.key === "ArrowLeft") setStep((v) => (v && v > 0 ? v - 1 : v));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, finish]);

  if (step === null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // Card placement: under the spotlight when anchored (clamped), else centred.
  const pad = 10;
  const cardW = 360;
  let cardStyle: React.CSSProperties;
  if (rect) {
    const below = rect.top + rect.height + pad + 210 < window.innerHeight;
    cardStyle = {
      position: "fixed",
      top: below ? rect.top + rect.height + pad + 6 : undefined,
      bottom: below ? undefined : window.innerHeight - rect.top + pad + 6,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - cardW - 12)),
      width: cardW,
    };
  } else {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%,-50%)",
      width: Math.min(cardW, window.innerWidth - 24),
    };
  }

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Dim + spotlight */}
      {rect ? (
        <div
          className="pointer-events-none fixed transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: 14,
            boxShadow: "0 0 0 9999px rgba(18,14,44,.6)",
            outline: "2px solid rgba(124,108,245,.9)",
          }}
        />
      ) : (
        <div className="fixed inset-0" style={{ background: "rgba(18,14,44,.6)" }} onClick={finish} />
      )}

      {/* Card */}
      <div
        className="rounded-2xl bg-white p-5 shadow-2xl"
        style={{ ...cardStyle, boxShadow: "0 24px 60px rgba(18,14,44,.4)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] font-bold tracking-wide text-[#7c6cf5]">
            STEP {step + 1} OF {STEPS.length}
          </div>
          <button onClick={finish} className="-mr-1 -mt-1 rounded-md px-2 py-0.5 text-xs text-stone-400 hover:bg-stone-100" aria-label="Skip tour">
            Skip ✕
          </button>
        </div>
        <h3 className="mt-1 text-[17px] font-extrabold tracking-tight text-stone-900">{s.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">{s.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{ background: i === step ? "#7c6cf5" : "#e4e2f2" }} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-[13px] font-semibold text-stone-600 hover:bg-stone-50">
                Back
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setStep(step + 1))}
              className="rounded-lg px-4 py-1.5 text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(120deg,#7c6cf5,#9b6cf5)", boxShadow: "0 4px 12px rgba(124,108,245,.35)" }}>
              {last ? "Finish" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
