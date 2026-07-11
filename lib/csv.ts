import { poundsToPennies } from "./money";

export interface ParsedBankRow {
  date: string; // ISO
  description: string;
  amount: number; // pennies, signed (+ money in, - money out)
}

// Convert a UK date (DD/MM/YYYY) or ISO date to ISO (YYYY-MM-DD).
function toIsoDate(raw: string): string {
  const s = raw.trim();
  const uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const [, d, m, y] = uk;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s; // assume already ISO-ish
}

// Minimal CSV parser for a Date,Description,Amount statement.
// Amount may include £ and thousands separators; sign preserved.
export function parseBankCsv(text: string): ParsedBankRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Drop a header row if the first cell isn't a date/number.
  const first = lines[0].split(",")[0].toLowerCase();
  const startIdx = first.includes("date") ? 1 : 0;

  const rows: ParsedBankRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 3) continue;
    const date = toIsoDate(cols[0]);
    // Description may itself contain commas -> take middle cols, amount is last.
    const amountStr = cols[cols.length - 1];
    const description = cols.slice(1, cols.length - 1).join(",").trim();
    const cleaned = amountStr.replace(/[£$,\s]/g, "");
    const pounds = Number(cleaned);
    if (!Number.isFinite(pounds)) continue;
    rows.push({ date, description, amount: poundsToPennies(pounds) });
  }
  return rows;
}
