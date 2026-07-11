import { splitGross } from "./money";

// ============================================================================
// MOCK OCR + AI CATEGORISATION
// ----------------------------------------------------------------------------
// This stands in for a real pipeline (PaddleOCR extraction -> LLM normalisation
// & categorisation). It returns realistic extracted fields plus a suggested
// account category and a confidence score. It is 100% deterministic and needs
// no API key. Swap this module for a real OCR/LLM call later — the rest of the
// app (review-queue threshold, posting) does not change. See NOTES.md.
// ============================================================================

export interface OcrResult {
  supplier: string;
  date: string; // ISO
  gross: number; // pennies
  vat: number; // pennies
  net: number; // pennies
  vatTreatment: "standard" | "none";
  suggestedCode: string; // chart-of-accounts code
  confidence: number; // 0..1
  rawText: string; // pretend OCR text, for the audit log
}

interface Scenario {
  key: string;
  label: string;
  supplier: string;
  date: string;
  gross: number;
  vatTreatment: "standard" | "none";
  suggestedCode: string;
  confidence: number;
}

// A spread of high-confidence (auto-post) and low-confidence (review) receipts.
export const SCENARIOS: Scenario[] = [
  {
    key: "fuel",
    label: "Fuel receipt (high confidence)",
    supplier: "Shell",
    date: "2026-04-11",
    gross: 7200,
    vatTreatment: "standard",
    suggestedCode: "6200", // Motor & Travel
    confidence: 0.95,
  },
  {
    key: "office",
    label: "Office supplies (high confidence)",
    supplier: "Office World",
    date: "2026-04-19",
    gross: 4380,
    vatTreatment: "standard",
    suggestedCode: "6000", // Office Supplies
    confidence: 0.88,
  },
  {
    key: "rent",
    label: "Rent invoice (high confidence, no VAT)",
    supplier: "City Lettings",
    date: "2026-05-01",
    gross: 120000,
    vatTreatment: "none",
    suggestedCode: "6100", // Rent
    confidence: 0.96,
  },
  {
    key: "cafe",
    label: "Ambiguous café receipt (low confidence)",
    supplier: "The Corner Bistro",
    date: "2026-05-14",
    gross: 8400,
    vatTreatment: "standard",
    suggestedCode: "6500", // Advertising & Marketing (uncertain)
    confidence: 0.61,
  },
  {
    key: "misc",
    label: "Faded corner-shop receipt (low confidence)",
    supplier: "Premier Stores",
    date: "2026-05-22",
    gross: 2340,
    vatTreatment: "standard",
    suggestedCode: "6000",
    confidence: 0.54,
  },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Run the mock OCR. If a scenario key is given, use it; otherwise pick one
// deterministically from the filename so the same file always yields the same
// result (no Math.random -> reproducible demos).
export function runMockOcr(filename: string, scenarioKey?: string): OcrResult {
  const scenario =
    SCENARIOS.find((s) => s.key === scenarioKey) ??
    SCENARIOS[hashString(filename) % SCENARIOS.length];

  const split =
    scenario.vatTreatment === "standard"
      ? splitGross(scenario.gross)
      : { net: scenario.gross, vat: 0 };

  return {
    supplier: scenario.supplier,
    date: scenario.date,
    gross: scenario.gross,
    vat: split.vat,
    net: split.net,
    vatTreatment: scenario.vatTreatment,
    suggestedCode: scenario.suggestedCode,
    confidence: scenario.confidence,
    rawText: `${scenario.supplier}\nDate ${scenario.date}\nTOTAL £${(
      scenario.gross / 100
    ).toFixed(2)}${
      split.vat ? `\nVAT £${(split.vat / 100).toFixed(2)}` : ""
    }`,
  };
}

// Firm-configurable in the real product; fixed here for the demo.
export const CONFIDENCE_THRESHOLD = 0.8;
