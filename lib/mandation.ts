import { many, run } from "./db";
import {
  assessMandation,
  type ClientTriageInput,
  type MandationAssessment,
  type MtdClientStatus,
} from "./engine/mandation-engine";
import type { QiSourceYear, QiSourceType } from "./engine/qualifying-income";

// REAL mandation checker — the mock is gone. Runs the ported legal engine
// (lib/engine, 26-case test suite, verified against SI 2026/336) over each
// client's flags and look-back-year gross income (source_year_income table).
// The production build additionally reconciles against HMRC's ITSA Status API.

export interface MandationResult {
  clientId: number;
  name: string;
  status: MtdClientStatus;
  wave: string | null; // display: "2026" | "2027" | "2028+"
  mandatedFrom: string | null;
  reasons: string[];
  latestQualifyingIncome: number | null; // pennies
  latestYearLabel: string | null;
  requiresManualReview: boolean;
  agentAuth: string;
}

interface ClientFlagsRow {
  id: number;
  name: string;
  nino: string | null;
  agent_auth_status: string;
  is_uk_resident: number;
  files_sa900: number;
  files_sa700: number;
  lloyds_underwriter: number;
  minister_of_religion: number;
  power_of_attorney: number;
  mca_bpa: number;
  files_sa109: number;
  files_sa107: number;
  claims_averaging: number;
  qualifying_care: number;
  nonres_entertainer: number;
  voluntary_signup: number;
  digital_exclusion: string;
  ceased_on: string | null;
}

interface SourceYearRow {
  client_id: number;
  tax_year_start: number;
  type: string;
  description: string | null;
  gross_income: number;
  share_percent: number;
  months_active: number;
  alt_annualisation: number;
}

export function waveDisplay(a: MandationAssessment): string | null {
  switch (a.wave) {
    case "wave1-2026": return "2026";
    case "wave2-2027": return "2027";
    case "wave3-2028plus": return "2028+";
    default: return null;
  }
}

export { statusLabel } from "./engine/mandation-engine";

function toTriageInput(c: ClientFlagsRow, rows: SourceYearRow[]): ClientTriageInput {
  const incomeByYear = new Map<number, QiSourceYear[]>();
  for (const r of rows) {
    const list = incomeByYear.get(r.tax_year_start) ?? [];
    list.push({
      type: r.type as QiSourceType,
      description: r.description,
      grossIncome: r.gross_income,
      sharePercent: r.share_percent,
      monthsActive: r.months_active,
      altAnnualisation: !!r.alt_annualisation,
    });
    incomeByYear.set(r.tax_year_start, list);
  }
  return {
    nino: c.nino,
    isUkResident: !!c.is_uk_resident,
    filesSa900: !!c.files_sa900,
    filesSa700: !!c.files_sa700,
    isLloydsUnderwriter: !!c.lloyds_underwriter,
    isMinisterOfReligion: !!c.minister_of_religion,
    hasPowerOfAttorney: !!c.power_of_attorney,
    claimsMcaOrBpa: !!c.mca_bpa,
    filesSa109: !!c.files_sa109,
    filesSa107: !!c.files_sa107,
    claimsAveraging: !!c.claims_averaging,
    receivesQualifyingCareRelief: !!c.qualifying_care,
    isNonResidentEntertainer: !!c.nonres_entertainer,
    voluntarilySignedUp: !!c.voluntary_signup,
    digitalExclusion: (c.digital_exclusion as ClientTriageInput["digitalExclusion"]) ?? "not-applied",
    ceasedAllSourcesOn: c.ceased_on,
    incomeByYear,
  };
}

/** Run the real engine across every client in the firm and persist the outcome
 *  (status, wave, mandated-from, full reasons trail) on the client row. */
export async function runMandationCheck(firmId: number): Promise<MandationResult[]> {
  const clients = await many<ClientFlagsRow>(
    `SELECT * FROM clients WHERE firm_id = ?`, [firmId]);
  const yearRows = await many<SourceYearRow>(
    `SELECT * FROM source_year_income WHERE firm_id = ? ORDER BY tax_year_start`, [firmId]);

  const byClient = new Map<number, SourceYearRow[]>();
  for (const r of yearRows) {
    const list = byClient.get(r.client_id) ?? [];
    list.push(r);
    byClient.set(r.client_id, list);
  }

  const results: MandationResult[] = [];
  for (const c of clients) {
    const a = assessMandation(toTriageInput(c, byClient.get(c.id) ?? []));
    const wave = waveDisplay(a);
    await run(
      `UPDATE clients SET mandation_status = ?, mandation_wave = ?,
              mandation_from = ?, mandation_reasons = ? WHERE id = ?`,
      [a.status, wave, a.mandatedFrom, JSON.stringify(a.reasons), c.id],
    );
    const latest = a.yearlyIncome.length
      ? a.yearlyIncome[a.yearlyIncome.length - 1]
      : null;
    results.push({
      clientId: c.id,
      name: c.name,
      status: a.status,
      wave,
      mandatedFrom: a.mandatedFrom,
      reasons: a.reasons,
      latestQualifyingIncome: latest?.total ?? null,
      latestYearLabel: latest
        ? `${latest.year.startYear}-${String((latest.year.startYear + 1) % 100).padStart(2, "0")}`
        : null,
      requiresManualReview: a.requiresManualReview,
      agentAuth: c.agent_auth_status,
    });
  }
  return results;
}
