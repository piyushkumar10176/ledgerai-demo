import { db, many, run } from "./db";
import type { QiSourceType } from "./engine/qualifying-income";
import { parseTaxYear } from "./engine/tax-year";

// TRI-01: client-book CSV import, ported from the audited .NET importer.
// Built for accountants' messy Excel exports: '£51,000' money, '50%' shares,
// spaced NINOs — all normalised; anything ambiguous or invalid becomes a
// line-numbered error and the ROW is skipped, never the whole import, and
// never a silent guess.
//
// clients.csv (only Name required; flags Y/N/blank):
//   Name, NINO, UTR, UkResident, SA900, SA700, Lloyds, Minister, PoA, McaBpa,
//   SA109, SA107, Averaging, QualifyingCare, NonResEntertainer, Voluntary, CeasedOn
// income.csv (matched by UTR, then NINO, then unambiguous Name):
//   ClientRef, TaxYear, Type, GrossIncome, SharePercent, MonthsActive,
//   AltAnnualisation, Description

export interface ImportResult {
  clientsCreated: number;
  clientsUpdated: number;
  incomeRowsImported: number;
  errors: string[];
}

// ---- CSV parsing (RFC-4180-ish, hardened) -----------------------------------

interface CsvParse {
  rows: Record<string, string>[];
  errors: string[];
}

export function parseCsv(content: string): CsvParse {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // Excel BOM

  const { records, errors } = splitRecords(content);
  if (records.length === 0) return { rows: [], errors };

  const headers = records[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < records.length; r++) {
    const record = records[r];
    if (record.length === 1 && record[0].trim() === "") continue;
    if (record.length !== headers.length) {
      errors.push(`line ${r + 1}: expected ${headers.length} fields but found ${record.length} — row skipped.`);
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.toLowerCase()] = record[i].trim()));
    rows.push(row);
  }
  return { rows, errors };
}

function splitRecords(content: string): { records: string[][]; errors: string[] } {
  const records: string[][] = [];
  const errors: string[] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (c === '"') {
      field += '"'; // mid-field quote is a literal character ('Pipes 15"')
    } else if (c === ",") {
      current.push(field); field = ""; fieldStarted = false;
    } else if (c === "\r") {
      // skip
    } else if (c === "\n") {
      current.push(field); field = ""; fieldStarted = false;
      records.push(current); current = [];
    } else {
      field += c;
      fieldStarted = true;
    }
  }
  if (inQuotes)
    errors.push(`unterminated quote — rows after record ${records.length + 1} may be missing. Fix the quote and re-import.`);
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    records.push(current);
  }
  return { records, errors };
}

// ---- field normalisers --------------------------------------------------------

const get = (row: Record<string, string>, key: string): string | null => {
  const v = row[key.toLowerCase()];
  return v && v.trim() ? v.trim() : null;
};

const flag = (row: Record<string, string>, key: string, dflt = false): boolean => {
  const v = get(row, key);
  if (v === null) return dflt;
  return ["y", "yes", "true", "1"].includes(v.toLowerCase());
};

/** '£51,000' / '51 000.50' / '.50' / '1234.567' → pennies; null if unparseable.
 *  (Audit fix: the canonical .NET importer accepts bare-leading-decimal and
 *  >2dp amounts — parity restored, rounding to the penny.) */
export function parseMoneyPennies(text: string | null): number | null {
  if (text === null) return null;
  const cleaned = text.replace(/£|\s|,/g, "");
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function normaliseNino(raw: string | null): { value: string | null; error: string | null } {
  if (raw === null) return { value: null, error: null };
  const cleaned = raw.replace(/\s/g, "").toUpperCase();
  if (cleaned.length !== 9)
    return { value: null, error: `NINO '${raw}' is not 9 characters after removing spaces — field ignored.` };
  return { value: cleaned, error: null };
}

function normaliseUtr(raw: string | null): { value: string | null; error: string | null } {
  if (raw === null) return { value: null, error: null };
  const cleaned = raw.replace(/\s/g, "");
  if (!/^\d{10}$/.test(cleaned))
    return { value: null, error: `UTR '${raw}' is not 10 digits after removing spaces — field ignored.` };
  return { value: cleaned, error: null };
}

const TYPE_MAP: Record<string, QiSourceType> = {
  selfemployment: "self-employment",
  "self-employment": "self-employment",
  ukproperty: "uk-property",
  "uk-property": "uk-property",
  foreignproperty: "foreign-property",
  "foreign-property": "foreign-property",
  partnershipshare: "partnership-share",
  employment: "employment",
  dividends: "dividends",
  pension: "pension",
  qualifyingcarereceipts: "qualifying-care",
  "qualifying-care": "qualifying-care",
  transitionprofits: "transition-profits",
  oneofflandtransaction: "one-off-land",
  reitpaifincome: "reit-paif",
  other: "other",
};

// ---- the import ----------------------------------------------------------------

interface DbClient {
  id: number;
  name: string;
  nino: string | null;
  utr: string | null;
}

export async function importClientBook(
  firmId: number,
  clientsCsv: string,
  incomeCsv: string | null,
): Promise<ImportResult> {
  const errors: string[] = [];
  let created = 0, updated = 0, incomeRows = 0;

  const clientParse = parseCsv(clientsCsv);
  errors.push(...clientParse.errors.map((e) => `clients.csv: ${e}`));
  if (clientParse.rows.length === 0)
    return { clientsCreated: 0, clientsUpdated: 0, incomeRowsImported: 0,
             errors: [...errors, "clients.csv contained no data rows."] };

  const existing = await many<DbClient>(
    `SELECT id, name, nino, utr FROM clients WHERE firm_id = ?`, [firmId]);

  const byUtr = new Map(existing.filter((c) => c.utr).map((c) => [c.utr!.toUpperCase(), c]));
  const byNino = new Map(existing.filter((c) => c.nino).map((c) => [c.nino!.toUpperCase(), c]));
  const byName = new Map<string, DbClient>();
  const ambiguousNames = new Set<string>();
  for (const c of existing) {
    const key = c.name.toLowerCase();
    if (byName.has(key)) { ambiguousNames.add(key); byName.delete(key); }
    else if (!ambiguousNames.has(key)) byName.set(key, c);
  }

  // ---- clients.csv --------------------------------------------------------------
  for (let i = 0; i < clientParse.rows.length; i++) {
    const row = clientParse.rows[i];
    const line = i + 2;
    const name = get(row, "Name");
    if (!name) { errors.push(`clients.csv line ${line}: missing Name — skipped.`); continue; }
    const nameKey = name.toLowerCase();

    const { value: utr, error: utrErr } = normaliseUtr(get(row, "UTR"));
    const { value: nino, error: ninoErr } = normaliseNino(get(row, "NINO"));
    if (utrErr) errors.push(`clients.csv line ${line}: ${utrErr}`);
    if (ninoErr) errors.push(`clients.csv line ${line}: ${ninoErr}`);

    let client: DbClient | undefined =
      (utr && byUtr.get(utr)) || (nino && byNino.get(nino.toUpperCase())) || undefined;

    if (!client) {
      if (ambiguousNames.has(nameKey)) {
        errors.push(`clients.csv line ${line}: name '${name}' matches more than one existing client ` +
                    `and no UTR/NINO was given — add a UTR or NINO to disambiguate. Skipped.`);
        continue;
      }
      // Name-match only when identifiers don't CONTRADICT the matched client —
      // same name + different UTR is a different person.
      const nameMatch = byName.get(nameKey);
      if (nameMatch) {
        const utrConflict = utr && nameMatch.utr && nameMatch.utr.toUpperCase() !== utr;
        const ninoConflict = nino && nameMatch.nino && nameMatch.nino.toUpperCase() !== nino;
        client = utrConflict || ninoConflict ? undefined : nameMatch;
      }
    }

    const ceasedRaw = get(row, "CeasedOn");
    let ceasedOn: string | null = null;
    if (ceasedRaw) {
      const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ceasedRaw);
      const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(ceasedRaw);
      if (iso) ceasedOn = ceasedRaw;
      else if (uk) ceasedOn = `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
      else errors.push(`clients.csv line ${line}: CeasedOn '${ceasedRaw}' is not a date (use yyyy-mm-dd or dd/mm/yyyy) — ignored.`);
    }

    const fields = {
      is_uk_resident: flag(row, "UkResident", true) ? 1 : 0,
      files_sa900: flag(row, "SA900") ? 1 : 0,
      files_sa700: flag(row, "SA700") ? 1 : 0,
      lloyds_underwriter: flag(row, "Lloyds") ? 1 : 0,
      minister_of_religion: flag(row, "Minister") ? 1 : 0,
      power_of_attorney: flag(row, "PoA") ? 1 : 0,
      mca_bpa: flag(row, "McaBpa") ? 1 : 0,
      files_sa109: flag(row, "SA109") ? 1 : 0,
      files_sa107: flag(row, "SA107") ? 1 : 0,
      claims_averaging: flag(row, "Averaging") ? 1 : 0,
      qualifying_care: flag(row, "QualifyingCare") ? 1 : 0,
      nonres_entertainer: flag(row, "NonResEntertainer") ? 1 : 0,
      voluntary_signup: flag(row, "Voluntary") ? 1 : 0,
    };

    if (!client) {
      const res = await run(
        `INSERT INTO clients (firm_id, name, nino, utr, is_uk_resident, files_sa900, files_sa700,
           lloyds_underwriter, minister_of_religion, power_of_attorney, mca_bpa, files_sa109,
           files_sa107, claims_averaging, qualifying_care, nonres_entertainer, voluntary_signup, ceased_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [firmId, name, nino, utr, fields.is_uk_resident, fields.files_sa900, fields.files_sa700,
         fields.lloyds_underwriter, fields.minister_of_religion, fields.power_of_attorney,
         fields.mca_bpa, fields.files_sa109, fields.files_sa107, fields.claims_averaging,
         fields.qualifying_care, fields.nonres_entertainer, fields.voluntary_signup, ceasedOn],
      );
      client = { id: res.lastId, name, nino, utr };
      created++;
    } else {
      await run(
        `UPDATE clients SET name = ?, nino = COALESCE(?, nino), utr = COALESCE(?, utr),
           is_uk_resident = ?, files_sa900 = ?, files_sa700 = ?, lloyds_underwriter = ?,
           minister_of_religion = ?, power_of_attorney = ?, mca_bpa = ?, files_sa109 = ?,
           files_sa107 = ?, claims_averaging = ?, qualifying_care = ?, nonres_entertainer = ?,
           voluntary_signup = ?, ceased_on = COALESCE(?, ceased_on)
         WHERE id = ? AND firm_id = ?`,
        [name, nino, utr, fields.is_uk_resident, fields.files_sa900, fields.files_sa700,
         fields.lloyds_underwriter, fields.minister_of_religion, fields.power_of_attorney,
         fields.mca_bpa, fields.files_sa109, fields.files_sa107, fields.claims_averaging,
         fields.qualifying_care, fields.nonres_entertainer, fields.voluntary_signup, ceasedOn,
         client.id, firmId],
      );
      client.nino = nino ?? client.nino;
      client.utr = utr ?? client.utr;
      updated++;
    }

    if (client.utr) byUtr.set(client.utr.toUpperCase(), client);
    if (client.nino) byNino.set(client.nino.toUpperCase(), client);
    if (!ambiguousNames.has(nameKey)) {
      const already = byName.get(nameKey);
      if (already && already.id !== client.id) { byName.delete(nameKey); ambiguousNames.add(nameKey); }
      else byName.set(nameKey, client);
    }
  }

  // ---- income.csv: validate everything BEFORE touching stored data --------------
  if (incomeCsv && incomeCsv.trim()) {
    const incomeParse = parseCsv(incomeCsv);
    errors.push(...incomeParse.errors.map((e) => `income.csv: ${e}`));

    interface Staged {
      clientId: number; taxYearStart: number; type: QiSourceType;
      gross: number; share: number; months: number; alt: boolean; description: string | null;
    }
    const staged: Staged[] = [];

    for (let i = 0; i < incomeParse.rows.length; i++) {
      const row = incomeParse.rows[i];
      const line = i + 2;
      const ref = get(row, "ClientRef") ?? get(row, "Client") ?? get(row, "Name");
      if (!ref) { errors.push(`income.csv line ${line}: missing ClientRef — skipped.`); continue; }
      if (ambiguousNames.has(ref.toLowerCase())) {
        errors.push(`income.csv line ${line}: '${ref}' matches more than one client — reference by UTR or NINO instead. Skipped.`);
        continue;
      }
      const client =
        byUtr.get(ref.replace(/\s/g, "").toUpperCase()) ??
        byNino.get(ref.replace(/\s/g, "").toUpperCase()) ??
        byName.get(ref.toLowerCase());
      if (!client) { errors.push(`income.csv line ${line}: client '${ref}' not found — skipped.`); continue; }

      let yearStart: number;
      try { yearStart = parseTaxYear(get(row, "TaxYear") ?? "").startYear; }
      catch (e) { errors.push(`income.csv line ${line}: ${(e as Error).message} Skipped.`); continue; }

      const typeRaw = (get(row, "Type") ?? "").toLowerCase().replace(/[\s_]/g, "");
      const type = TYPE_MAP[typeRaw];
      if (!type) { errors.push(`income.csv line ${line}: unknown Type '${get(row, "Type")}' — skipped.`); continue; }

      const gross = parseMoneyPennies(get(row, "GrossIncome"));
      if (gross === null) {
        errors.push(`income.csv line ${line}: GrossIncome '${get(row, "GrossIncome")}' is not a valid amount — skipped.`);
        continue;
      }
      if (gross < 0) {
        errors.push(`income.csv line ${line}: GrossIncome is negative — gross income cannot be negative. Skipped.`);
        continue;
      }

      let share = 100;
      const shareRaw = get(row, "SharePercent");
      if (shareRaw !== null) {
        const cleaned = shareRaw.replace(/%\s*$/, "");
        share = Number(cleaned);
        if (!Number.isFinite(share) || share <= 0 || share > 100) {
          errors.push(`income.csv line ${line}: SharePercent '${shareRaw}' must be a number in (0, 100] — skipped.`);
          continue;
        }
      }

      let months = 12;
      const monthsRaw = get(row, "MonthsActive");
      if (monthsRaw !== null) {
        months = Number(monthsRaw);
        if (!Number.isInteger(months) || months < 1 || months > 12) {
          errors.push(`income.csv line ${line}: MonthsActive '${monthsRaw}' must be a whole number 1–12 (leave blank for a full year) — skipped.`);
          continue;
        }
      }

      staged.push({
        clientId: client.id, taxYearStart: yearStart, type, gross, share, months,
        alt: flag(row, "AltAnnualisation"), description: get(row, "Description"),
      });
      incomeRows++;
    }

    // Apply: each client+year in the VALID staged set replaces that year's rows —
    // a year is never wiped for rows that failed validation, and the whole
    // destructive phase runs as ONE batch (audit fix: a mid-apply DB failure
    // must not leave a year deleted with no replacement — all-or-nothing, like
    // the canonical .NET importer's single SaveChanges).
    const stmts: { sql: string; args: (string | number | null)[] }[] = [];
    const wiped = new Set<string>();
    for (const s of staged) {
      const key = `${s.clientId}:${s.taxYearStart}`;
      if (!wiped.has(key)) {
        stmts.push({
          sql: `DELETE FROM source_year_income WHERE firm_id = ? AND client_id = ? AND tax_year_start = ?`,
          args: [firmId, s.clientId, s.taxYearStart],
        });
        wiped.add(key);
      }
      stmts.push({
        sql: `INSERT INTO source_year_income
                (firm_id, client_id, tax_year_start, type, description, gross_income,
                 share_percent, months_active, alt_annualisation)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [firmId, s.clientId, s.taxYearStart, s.type, s.description, s.gross,
               s.share, s.months, s.alt ? 1 : 0],
      });
    }
    if (stmts.length > 0) {
      try {
        await (await db()).batch(stmts, "write");
      } catch (e) {
        errors.push(`income.csv: saving failed — no income changes were stored (${(e as Error).message}).`);
        incomeRows = 0;
      }
    }
  }

  return { clientsCreated: created, clientsUpdated: updated, incomeRowsImported: incomeRows, errors };
}
