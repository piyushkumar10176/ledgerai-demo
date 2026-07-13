// MTD Income Tax quarterly periods for tax year 2026/27.
// Updates are CUMULATIVE from the tax-year start (6 Apr); each supersedes the last.

export interface Quarter {
  key: string; // "2026Q1"
  label: string; // "Q1"
  taxYearStart: string; // cumulative window start (always tax-year start)
  periodStart: string; // the quarter's own start (for display)
  periodEnd: string; // cumulative window end
  deadline: string;
}

export const TAX_YEAR = "2026/27";
export const TAX_YEAR_START = "2026-04-06";

export const QUARTERS: Quarter[] = [
  { key: "2026Q1", label: "Q1", taxYearStart: "2026-04-06", periodStart: "2026-04-06", periodEnd: "2026-07-05", deadline: "2026-08-07" },
  { key: "2026Q2", label: "Q2", taxYearStart: "2026-04-06", periodStart: "2026-07-06", periodEnd: "2026-10-05", deadline: "2026-11-07" },
  { key: "2026Q3", label: "Q3", taxYearStart: "2026-04-06", periodStart: "2026-10-06", periodEnd: "2027-01-05", deadline: "2027-02-07" },
  { key: "2026Q4", label: "Q4", taxYearStart: "2026-04-06", periodStart: "2027-01-06", periodEnd: "2027-04-05", deadline: "2027-05-07" },
];

export function quarterByKey(key: string): Quarter | undefined {
  return QUARTERS.find((q) => q.key === key);
}

// The quarter currently "in play" for the demo (Q1 just closed; deadline 7 Aug).
export const CURRENT_QUARTER = QUARTERS[0];

export function daysUntil(iso: string): number {
  const due = new Date(iso + "T00:00:00Z").getTime();
  return Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24));
}
