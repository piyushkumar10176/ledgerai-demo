import { createClient } from "./data";
import { setClientServices } from "./services";
import { one } from "./db";
import { logAudit } from "./audit";

export interface ClientRow { name: string; nino?: string; utr?: string; phone?: string }

// Parse a firm's client list export (Excel/IRIS/TaxCalc style headers).
export function parseClientCsv(text: string): ClientRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iName = idx("name", "client", "taxpayer");
  const iNino = idx("nino", "ni number", "national insurance");
  const iUtr = idx("utr", "unique tax");
  const iPhone = idx("phone", "mobile", "tel");
  const hasHeader = iName >= 0;
  const rows: ClientRow[] = [];
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const c = lines[i].split(",").map((x) => x.trim());
    const name = (hasHeader ? c[iName] : c[0]) ?? "";
    if (!name) continue;
    rows.push({
      name,
      nino: iNino >= 0 ? c[iNino] : undefined,
      utr: iUtr >= 0 ? c[iUtr] : undefined,
      phone: iPhone >= 0 ? c[iPhone] : undefined,
    });
  }
  return rows;
}

// Bulk-create clients, skipping names that already exist for the firm.
export async function bulkImportClients(
  firmId: number, rows: ClientRow[], services: string[] = ["mtd-itsa"],
): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0;
  for (const r of rows) {
    const existing = await one<{ id: number }>(
      `SELECT id FROM clients WHERE firm_id = ? AND name = ?`, [firmId, r.name],
    );
    if (existing) { skipped++; continue; }
    const id = await createClient(firmId, { name: r.name, nino: r.nino, utr: r.utr, phone: r.phone });
    await setClientServices(id, services);
    created++;
  }
  await logAudit(firmId, "clients.bulk_imported", "firm", firmId, `${created} created, ${skipped} skipped`);
  return { created, skipped };
}
