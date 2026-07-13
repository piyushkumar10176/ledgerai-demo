// HMRC MTD Income Tax category enums (PRD §8 Layer 2), per income-source type.
// Codes mirror the shape of the Self-Employment / Property Business API fields.

export type SourceType = "self-employment" | "uk-property";
export type Direction = "income" | "expense";

export interface HmrcCategory {
  code: string;
  label: string;
  direction: Direction;
  sourceType: SourceType;
}

export const SELF_EMPLOYMENT_CATEGORIES: HmrcCategory[] = [
  { code: "turnover", label: "Turnover (sales)", direction: "income", sourceType: "self-employment" },
  { code: "otherIncome", label: "Other business income", direction: "income", sourceType: "self-employment" },
  // ~15 SA103 expense categories
  { code: "costOfGoods", label: "Cost of goods bought for resale", direction: "expense", sourceType: "self-employment" },
  { code: "paymentsToSubcontractors", label: "Subcontractors (CIS)", direction: "expense", sourceType: "self-employment" },
  { code: "wagesAndStaffCosts", label: "Wages & staff costs", direction: "expense", sourceType: "self-employment" },
  { code: "carVanTravelExpenses", label: "Motor & travel", direction: "expense", sourceType: "self-employment" },
  { code: "premisesRunningCosts", label: "Premises running costs", direction: "expense", sourceType: "self-employment" },
  { code: "maintenanceCosts", label: "Repairs & maintenance", direction: "expense", sourceType: "self-employment" },
  { code: "adminCosts", label: "Office & admin costs", direction: "expense", sourceType: "self-employment" },
  { code: "advertisingCosts", label: "Advertising & entertainment", direction: "expense", sourceType: "self-employment" },
  { code: "interestOnLoans", label: "Loan interest", direction: "expense", sourceType: "self-employment" },
  { code: "financeCharges", label: "Bank & finance charges", direction: "expense", sourceType: "self-employment" },
  { code: "irrecoverableDebts", label: "Bad debts", direction: "expense", sourceType: "self-employment" },
  { code: "professionalFees", label: "Professional fees", direction: "expense", sourceType: "self-employment" },
  { code: "depreciation", label: "Depreciation", direction: "expense", sourceType: "self-employment" },
  { code: "otherExpenses", label: "Other expenses", direction: "expense", sourceType: "self-employment" },
];

export const PROPERTY_CATEGORIES: HmrcCategory[] = [
  { code: "rentIncome", label: "Rent income", direction: "income", sourceType: "uk-property" },
  { code: "premiumsOfLease", label: "Premiums of lease grant", direction: "income", sourceType: "uk-property" },
  { code: "otherPropertyIncome", label: "Other property income", direction: "income", sourceType: "uk-property" },
  { code: "premisesRunningCosts", label: "Premises running costs", direction: "expense", sourceType: "uk-property" },
  { code: "repairsAndMaintenance", label: "Repairs & maintenance", direction: "expense", sourceType: "uk-property" },
  { code: "financialCosts", label: "Finance costs", direction: "expense", sourceType: "uk-property" },
  { code: "professionalFees", label: "Professional fees", direction: "expense", sourceType: "uk-property" },
  { code: "costOfServices", label: "Cost of services", direction: "expense", sourceType: "uk-property" },
  { code: "travelCosts", label: "Travel costs", direction: "expense", sourceType: "uk-property" },
  { code: "otherPropertyExpenses", label: "Other expenses", direction: "expense", sourceType: "uk-property" },
];

export function categoriesFor(sourceType: SourceType): HmrcCategory[] {
  return sourceType === "self-employment"
    ? SELF_EMPLOYMENT_CATEGORIES
    : PROPERTY_CATEGORIES;
}

export function categoryLabel(sourceType: SourceType, code: string): string {
  return categoriesFor(sourceType).find((c) => c.code === code)?.label ?? code;
}

export function categoryDirection(
  sourceType: SourceType,
  code: string,
): Direction | null {
  return categoriesFor(sourceType).find((c) => c.code === code)?.direction ?? null;
}

// The £90k per-source threshold: below it, expenses may be a single consolidated
// figure; at/above it, expenses must be itemised into the categories above.
export const CONSOLIDATION_THRESHOLD = 9_000_000; // pennies (£90,000)
