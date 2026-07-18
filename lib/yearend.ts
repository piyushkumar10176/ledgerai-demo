import { many } from "./db";
import { getClient, listIncomeSources } from "./data";
import { categoryLabel, type SourceType } from "./hmrc-categories";
import { TAX_YEAR, TAX_YEAR_START } from "./periods";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const gbp = (p: number) => (p / 100).toFixed(2);

// Build the year-end pack CSV: categorised totals + every transaction + flagged
// items, per income source (PRD §6.5 year-end pack export / working papers).
export async function buildYearEndCsv(firmId: number, clientId: number): Promise<{ filename: string; csv: string } | null> {
  const client = await getClient(firmId, clientId);
  if (!client) return null;
  const sources = await listIncomeSources(clientId);
  const yearEnd = "2027-04-05";
  const lines: string[] = [];
  lines.push(`LedgerAI UK — Year-end working papers`);
  lines.push(`Client,${csvCell(client.name)}`);
  lines.push(`NINO,${csvCell(client.nino ?? "")},UTR,${csvCell(client.utr ?? "")}`);
  lines.push(`Tax year,${TAX_YEAR},Period,${TAX_YEAR_START} to ${yearEnd}`);
  lines.push("");

  for (const s of sources) {
    lines.push(`Income source,${csvCell(s.business_name)},${s.type}`);
    const totals = await many<{ category: string; direction: string; total: number; n: number }>(
      `SELECT category, direction, COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
         FROM transactions WHERE income_source_id = ? AND status IN ('auto','confirmed') AND category IS NOT NULL
           AND txn_date >= ? AND txn_date <= ?
         GROUP BY category, direction ORDER BY direction DESC, total DESC`,
      [s.id, TAX_YEAR_START, yearEnd],
    );
    lines.push("Category totals,Type,Count,Amount (£)");
    let inc = 0, exp = 0;
    for (const t of totals) {
      if (t.direction === "income") inc += t.total; else exp += t.total;
      lines.push(`${csvCell(categoryLabel(s.type as SourceType, t.category))},${t.direction},${t.n},${gbp(t.total)}`);
    }
    lines.push(`Total income,,,${gbp(inc)}`);
    lines.push(`Total expenses,,,${gbp(exp)}`);
    lines.push(`Net profit,,,${gbp(inc - exp)}`);
    lines.push("");

    const txns = await many<{ txn_date: string; description: string; category: string | null; direction: string; amount: number; status: string; provenance: string | null }>(
      `SELECT txn_date, description, category, direction, amount, status, provenance
         FROM transactions WHERE income_source_id = ? AND txn_date >= ? AND txn_date <= ?
         ORDER BY txn_date`,
      [s.id, TAX_YEAR_START, yearEnd],
    );
    lines.push("Date,Description,Category,Type,Amount (£),Status,Source");
    for (const t of txns) {
      lines.push([t.txn_date, csvCell(t.description), t.category ? csvCell(categoryLabel(s.type as SourceType, t.category)) : "Uncategorised", t.direction, gbp(t.amount), t.status, csvCell(t.provenance ?? "")].join(","));
    }
    const flagged = txns.filter((t) => t.status === "review");
    if (flagged.length) {
      lines.push("");
      lines.push(`Flagged for review,${flagged.length}`);
      for (const t of flagged) lines.push([t.txn_date, csvCell(t.description), gbp(t.amount)].join(","));
    }
    lines.push("");
  }

  return { filename: `year-end-${client.name.replace(/[^A-Za-z0-9]/g, "-")}-${TAX_YEAR.replace("/", "-")}.csv`, csv: lines.join("\n") };
}
