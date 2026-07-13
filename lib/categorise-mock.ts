import type { SourceType, Direction } from "./hmrc-categories";

// ============================================================================
// MOCK AI CATEGORISATION + OCR
// Stands in for the real pipeline (PaddleOCR extraction -> Claude categorisation
// into HMRC category enums + confidence + RAG). Deterministic, no API key.
// Swap this module for a real model later; the rest of the app is unchanged.
// ============================================================================

export const CONFIDENCE_THRESHOLD = 0.8;

interface Rule {
  match: RegExp;
  se: string; // self-employment category code
  property: string; // uk-property category code
  direction: Direction;
  confidence: number;
}

// Keyword → HMRC category, per source type. Confidence reflects how clear the
// supplier/description is (ambiguous ones fall below the threshold -> review).
const RULES: Rule[] = [
  { match: /takings|sumup|sales|invoice|stripe|card settlement/i, se: "turnover", property: "otherPropertyIncome", direction: "income", confidence: 0.96 },
  { match: /rent received|tenant|lettings income/i, se: "otherIncome", property: "rentIncome", direction: "income", confidence: 0.95 },
  { match: /flour|wholesale|stock|materials|supplies for resale/i, se: "costOfGoods", property: "costOfServices", direction: "expense", confidence: 0.9 },
  { match: /subcontractor|cis|labour/i, se: "paymentsToSubcontractors", property: "costOfServices", direction: "expense", confidence: 0.9 },
  { match: /wage|salary|payroll|staff/i, se: "wagesAndStaffCosts", property: "otherPropertyExpenses", direction: "expense", confidence: 0.9 },
  { match: /fuel|shell|bp|petrol|diesel|mileage|train|rail|parking|uber/i, se: "carVanTravelExpenses", property: "travelCosts", direction: "expense", confidence: 0.93 },
  { match: /rent|lettings|premises|british gas|edf|water|council/i, se: "premisesRunningCosts", property: "premisesRunningCosts", direction: "expense", confidence: 0.88 },
  { match: /repair|maintenance|plumber|electrician|boiler/i, se: "maintenanceCosts", property: "repairsAndMaintenance", direction: "expense", confidence: 0.9 },
  { match: /office|stationery|phone|broadband|software|subscription|hosting/i, se: "adminCosts", property: "otherPropertyExpenses", direction: "expense", confidence: 0.87 },
  { match: /advert|marketing|facebook|google ads/i, se: "advertisingCosts", property: "otherPropertyExpenses", direction: "expense", confidence: 0.86 },
  { match: /accountant|solicitor|legal|professional|consult/i, se: "professionalFees", property: "professionalFees", direction: "expense", confidence: 0.9 },
  { match: /bank charge|interest|finance/i, se: "financeCharges", property: "financialCosts", direction: "expense", confidence: 0.88 },
];

export interface CategorySuggestion {
  category: string;
  direction: Direction;
  confidence: number;
}

// Suggest an HMRC category for a bank-line / description. Falls back to a
// low-confidence "otherExpenses" so genuinely ambiguous items go to review.
export function suggestCategory(
  description: string,
  sourceType: SourceType,
  amount: number, // signed pennies: + income, - expense
): CategorySuggestion {
  const isIncome = amount > 0;
  for (const r of RULES) {
    if (r.match.test(description)) {
      const cat = sourceType === "self-employment" ? r.se : r.property;
      // Respect the direction implied by the amount sign where they conflict.
      if ((r.direction === "income") === isIncome)
        return { category: cat, direction: r.direction, confidence: r.confidence };
    }
  }
  // Unknown: low confidence -> review queue.
  return isIncome
    ? {
        category: sourceType === "self-employment" ? "otherIncome" : "otherPropertyIncome",
        direction: "income",
        confidence: 0.55,
      }
    : {
        category: sourceType === "self-employment" ? "otherExpenses" : "otherPropertyExpenses",
        direction: "expense",
        confidence: 0.52,
      };
}

// Mock OCR for a receipt: fabricate realistic extracted fields from the filename
// (or an explicit scenario) + a category suggestion. Deterministic.
export interface ReceiptExtract {
  supplier: string;
  date: string;
  amount: number; // pennies (expense, positive magnitude)
  category: string;
  confidence: number;
  rawText: string;
}

interface Scenario {
  key: string;
  label: string;
  supplier: string;
  date: string;
  amount: number;
  descForCategory: string;
}

export const RECEIPT_SCENARIOS: Scenario[] = [
  { key: "fuel", label: "Fuel receipt (high confidence)", supplier: "Shell", date: "2026-05-11", amount: 7200, descForCategory: "Shell fuel" },
  { key: "materials", label: "Materials receipt (high confidence)", supplier: "Wickes", date: "2026-05-18", amount: 14400, descForCategory: "building materials" },
  { key: "accountant", label: "Professional fee (high confidence)", supplier: "Baker & Co", date: "2026-06-01", amount: 30000, descForCategory: "accountant fee" },
  { key: "cafe", label: "Ambiguous café receipt (low confidence)", supplier: "The Corner Bistro", date: "2026-06-14", amount: 4200, descForCategory: "cafe lunch" },
  { key: "misc", label: "Faded corner-shop receipt (low confidence)", supplier: "Premier Stores", date: "2026-06-22", amount: 2340, descForCategory: "corner shop" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function runMockReceiptOcr(
  filename: string,
  sourceType: SourceType,
  scenarioKey?: string,
): ReceiptExtract {
  const s =
    RECEIPT_SCENARIOS.find((x) => x.key === scenarioKey) ??
    RECEIPT_SCENARIOS[hashString(filename) % RECEIPT_SCENARIOS.length];
  const cat = suggestCategory(s.descForCategory, sourceType, -s.amount);
  return {
    supplier: s.supplier,
    date: s.date,
    amount: s.amount,
    category: cat.category,
    confidence: cat.confidence,
    rawText: `${s.supplier}\nDate ${s.date}\nTOTAL £${(s.amount / 100).toFixed(2)}`,
  };
}
