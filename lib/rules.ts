import { one, run } from "./db";

// Extract a stable supplier keyword from a description (first word ≥ 4 chars).
export function supplierKey(description: string): string {
  const w = description.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((x) => x.length >= 4);
  return w[0] ?? description.toLowerCase().slice(0, 8);
}

// Save a learned rule (from a human override). Client-specific.
export async function saveRule(firmId: number, clientId: number, description: string, category: string): Promise<void> {
  const pattern = supplierKey(description);
  const existing = await one<{ id: number }>(
    `SELECT id FROM category_rules WHERE firm_id = ? AND client_id = ? AND pattern = ?`,
    [firmId, clientId, pattern],
  );
  if (existing) await run(`UPDATE category_rules SET category = ? WHERE id = ?`, [category, existing.id]);
  else await run(`INSERT INTO category_rules (firm_id, client_id, pattern, category) VALUES (?, ?, ?, ?)`, [firmId, clientId, pattern, category]);
}

// Apply learned rules: client-specific first, then firm-wide. Returns category or null.
export async function applyRule(firmId: number, clientId: number, description: string): Promise<string | null> {
  const d = description.toLowerCase();
  const row = await one<{ category: string }>(
    `SELECT category FROM category_rules
      WHERE firm_id = ? AND (client_id = ? OR client_id IS NULL) AND instr(?, pattern) > 0
      ORDER BY (client_id = ?) DESC, length(pattern) DESC LIMIT 1`,
    [firmId, clientId, d, clientId],
  );
  return row?.category ?? null;
}
