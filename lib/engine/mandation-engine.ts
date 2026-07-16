// TRI-06: assesses a client's MTD IT position from their income history and
// circumstance flags, producing a dated status plus a human-readable reasons
// trail (every conclusion must be explainable to the accountant).
//
// Precedence, per SI 2026/336:
//   1. Automatic exemptions (Part 7 Ch 3/4) — regardless of income
//   2. Granted digital-exclusion exemption
//   3. Income-based mandation per look-back year, honouring deferrals (Ch 6)
//   4. Permanent cessation (obligations end after the cessation year)
//   5. Exit rule: three consecutive below-threshold MTD years (gaps break the run)
//   6. Below threshold → not mandated (or voluntary if the client opted in)
//
// Faithful port of LedgerAI.Domain.Triage.MandationEngine (the .NET build with
// its 24-case legal test suite is canonical — keep the two in sync).

import { taxYear, taxYearLabel, taxYearOfDate, type TaxYear } from "./tax-year";
import {
  CURRENT_RULES,
  mandationStartFor,
  thresholdFor,
  waveFor,
  type MandationRules,
  type Wave,
} from "./rules";
import {
  computeQualifyingIncome,
  type QiSourceYear,
  type YearQualifyingIncome,
} from "./qualifying-income";

export type MtdClientStatus =
  | "not-assessed"
  | "not-mandated"
  | "mandated"
  | "voluntary"
  | "exempt"
  | "deferred-to-april-2027"
  | "digitally-excluded-pending"
  | "digitally-excluded"
  | "opt-out-eligible"
  | "ceased";

export type ExemptionCategory =
  | "none"
  | "sa900-trust-estate"
  | "sa700-non-resident-company"
  | "no-nino"
  | "lloyds-underwriter"
  | "minister-of-religion"
  | "power-of-attorney"
  | "mca-bpa-claimant"
  | "digitally-excluded";

export interface ClientTriageInput {
  nino?: string | null;
  isUkResident: boolean;

  // Automatic exemption markers (SI 2026/336 Part 7; TRI-08)
  filesSa900?: boolean;
  filesSa700?: boolean;
  isLloydsUnderwriter?: boolean;
  isMinisterOfReligion?: boolean;
  hasPowerOfAttorney?: boolean;
  claimsMcaOrBpa?: boolean;

  // Deferral markers: these groups join April 2027, not April 2026 (TRI-10)
  filesSa109?: boolean;
  filesSa107?: boolean;
  claimsAveraging?: boolean;
  receivesQualifyingCareRelief?: boolean;
  isNonResidentEntertainer?: boolean;

  digitalExclusion?: "not-applied" | "pending" | "granted" | "refused";
  voluntarilySignedUp?: boolean;
  /** ISO date all sole-trade/property sources permanently ceased. */
  ceasedAllSourcesOn?: string | null;

  /** Per-look-back-year gross income rows. Key = tax-year start year. */
  incomeByYear: Map<number, QiSourceYear[]>;
}

/** Human label for an engine status. Pure — safe in client components. */
export function statusLabel(status: string): string {
  switch (status) {
    case "mandated": return "Mandated";
    case "not-mandated": case "not_mandated": return "Not mandated";
    case "voluntary": return "Voluntary";
    case "exempt": return "Exempt";
    case "deferred-to-april-2027": return "Deferred to Apr 2027";
    case "digitally-excluded-pending": return "Digital exclusion pending";
    case "digitally-excluded": return "Digitally excluded";
    case "opt-out-eligible": return "Opt-out eligible";
    case "ceased": return "Ceased";
    case "not-assessed": case "unknown": return "Not assessed";
    default: return status;
  }
}

export interface MandationAssessment {
  status: MtdClientStatus;
  wave: Wave;
  mandatedFrom: string | null; // ISO
  exemption: ExemptionCategory;
  reasons: string[];
  yearlyIncome: YearQualifyingIncome[];
  requiresManualReview: boolean;
}

const gbp = (pennies: number) =>
  "£" + Math.round(pennies / 100).toLocaleString("en-GB");

function detectAutomaticExemption(
  c: ClientTriageInput,
  reasons: string[],
): ExemptionCategory {
  if (c.filesSa900) {
    reasons.push("Files SA900 (trust/estate) — automatically exempt from MTD IT.");
    return "sa900-trust-estate";
  }
  if (c.filesSa700) {
    reasons.push("SA700 non-resident company — automatically exempt.");
    return "sa700-non-resident-company";
  }
  if (!c.nino || !c.nino.trim()) {
    reasons.push("No National Insurance number on file — automatically exempt (verify before relying).");
    return "no-nino";
  }
  if (c.isLloydsUnderwriter) {
    reasons.push("Lloyd's underwriter (SA103L) — automatically exempt.");
    return "lloyds-underwriter";
  }
  if (c.isMinisterOfReligion) {
    reasons.push("Minister of religion (SA102M) — automatically exempt.");
    return "minister-of-religion";
  }
  if (c.hasPowerOfAttorney) {
    reasons.push("Power of attorney / court-appointed deputy in place — automatically exempt.");
    return "power-of-attorney";
  }
  if (c.claimsMcaOrBpa) {
    reasons.push("Claims Married Couple's/Blind Person's Allowance — exempt for the current Parliament.");
    return "mca-bpa-claimant";
  }
  return "none";
}

function isDeferredGroup(c: ClientTriageInput, reasons: string[]): boolean {
  const flags: string[] = [];
  if (c.filesSa109) flags.push("SA109 (non-resident/remittance basis)");
  if (c.filesSa107) flags.push("SA107 (trust income)");
  if (c.claimsAveraging) flags.push("averaging claimant");
  if (c.receivesQualifyingCareRelief) flags.push("qualifying care relief");
  if (c.isNonResidentEntertainer) flags.push("non-resident entertainer/sportsperson");
  if (flags.length === 0) return false;
  reasons.push(`Deferred group (${flags.join(", ")}): cannot be mandated before April 2027.`);
  return true;
}

export function assessMandation(
  client: ClientTriageInput,
  asOfIso?: string,
  rules: MandationRules = CURRENT_RULES,
): MandationAssessment {
  const today = asOfIso ?? new Date().toISOString().slice(0, 10);
  const reasons: string[] = [];

  const base = (
    status: MtdClientStatus,
    wave: Wave,
    mandatedFrom: string | null,
    yearlyIncome: YearQualifyingIncome[],
    manualReview = false,
    exemption: ExemptionCategory = "none",
  ): MandationAssessment => ({
    status, wave, mandatedFrom, exemption, reasons,
    yearlyIncome, requiresManualReview: manualReview,
  });

  // 1. Automatic exemptions
  const exemption = detectAutomaticExemption(client, reasons);
  if (exemption !== "none")
    return base("exempt", "none", null, [], false, exemption);

  // 2. Digital exclusion (granted)
  if (client.digitalExclusion === "granted") {
    reasons.push("Digital-exclusion exemption granted by HMRC — outside MTD while it stands.");
    return base("digitally-excluded", "none", null, [], false, "digitally-excluded");
  }

  // 3. Qualifying income per look-back year
  const byYear: YearQualifyingIncome[] = [...client.incomeByYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([y, sources]) =>
      computeQualifyingIncome(taxYear(y), sources, client.isUkResident),
    );

  if (byYear.length === 0) {
    reasons.push("No income data on file — import the client's return figures to assess.");
    return base("not-assessed", "none", null, []);
  }

  const manualReview = byYear.some((y) => y.requiresManualReview);
  const deferred = isDeferredGroup(client, reasons);

  let trigger: YearQualifyingIncome | null = null;
  for (const y of byYear) {
    const threshold = thresholdFor(y.year);
    if (threshold === null) continue;

    const start = mandationStartFor(y.year);
    if (deferred && start < rules.deferredGroupsEarliestMandation) {
      reasons.push(
        `${taxYearLabel(y.year)}: test skipped — deferred group cannot be mandated before 6 April 2027.`,
      );
      continue;
    }

    if (y.total > threshold) {
      trigger = y;
      reasons.push(
        `${taxYearLabel(y.year)}: qualifying income ${gbp(y.total)} exceeds the ${gbp(threshold)} threshold.`,
      );
      break; // earliest triggering year wins; the exit rule governs leaving
    }
    reasons.push(
      `${taxYearLabel(y.year)}: qualifying income ${gbp(y.total)} is at or below the ${gbp(threshold)} threshold.`,
    );
  }

  // 4/5/6. Outcome
  if (!trigger) {
    if (
      deferred &&
      byYear.every((y) => mandationStartFor(y.year) < rules.deferredGroupsEarliestMandation)
    ) {
      reasons.push("Deferred group: re-assess with 2025-26 figures — joins from April 2027 if over £30,000.");
      return base("deferred-to-april-2027", "none", null, byYear, manualReview);
    }
    if (client.voluntarilySignedUp) {
      reasons.push("Below threshold but voluntarily signed up — only the final declaration is penalty-bearing.");
      return base("voluntary", "none", null, byYear, manualReview);
    }
    const latest = byYear[byYear.length - 1];
    if (latest.total <= 2_000_000)
      reasons.push("Income-based automatic exemption: qualifying income at or below £20,000.");
    return base("not-mandated", "none", null, byYear, manualReview);
  }

  const start = mandationStartFor(trigger.year);
  const wave = waveFor(start);

  // Permanent cessation: obligations end after final reporting for the
  // cessation tax year — the three-year exit rule does not apply.
  if (client.ceasedAllSourcesOn) {
    const cy = taxYearOfDate(client.ceasedAllSourcesOn);
    reasons.push(
      `All sole-trade/property sources permanently ceased on ${client.ceasedAllSourcesOn} — ` +
      `obligations end after final reporting for ${taxYearLabel(cy)}; the three-year exit rule does not apply.`,
    );
    return base("ceased", wave, start, byYear, manualReview);
  }

  // Exit rule (TRI-11): three CONSECUTIVE below-threshold tax years, counted only
  // from the first year actually reported under MTD (the mandation-start year) —
  // pre-MTD look-back years do not count [ATT: "three consecutive years IN MTD"],
  // and a missing year of data breaks the run.
  const firstMtdYearStart = Number(start.slice(0, 4));
  const mtdYears = byYear
    .filter((y) => y.year.startYear >= firstMtdYearStart)
    .sort((a, b) => a.year.startYear - b.year.startYear);

  let consecutiveBelow = 0;
  let prevYearStart: number | null = null;
  let gapInData = false;
  for (const y of mtdYears) {
    if (prevYearStart !== null && y.year.startYear !== prevYearStart + 1) {
      gapInData = true;
      consecutiveBelow = 0; // an unassessed year cannot be presumed below threshold
    }
    prevYearStart = y.year.startYear;

    const t = thresholdFor(y.year);
    if (t !== null && y.total <= t) consecutiveBelow++;
    else consecutiveBelow = 0;
  }
  if (gapInData)
    reasons.push(
      "Missing tax year(s) in the income data — gaps break the exit-rule run; " +
      "import the missing years for a definitive opt-out answer.",
    );
  if (consecutiveBelow >= rules.exitRuleConsecutiveYears) {
    reasons.push(
      `Exit rule met: ${consecutiveBelow} consecutive MTD years below the threshold — client may opt out.`,
    );
    return base("opt-out-eligible", wave, start, byYear, manualReview);
  }
  if (consecutiveBelow > 0)
    reasons.push(
      `${consecutiveBelow} consecutive below-threshold MTD year(s) — ` +
      `${rules.exitRuleConsecutiveYears} needed before opt-out.`,
    );

  if (client.digitalExclusion === "pending") {
    reasons.push("Digital-exclusion application pending (HMRC targets 28 days) — mandated meanwhile.");
    return base("digitally-excluded-pending", wave, start, byYear, manualReview);
  }

  reasons.push(
    start <= today
      ? `Mandated since 6 April ${start.slice(0, 4)} (${wave}).`
      : `Mandated from 6 April ${start.slice(0, 4)} (${wave}) — onboard before the first quarterly deadline.`,
  );
  return base("mandated", wave, start, byYear, manualReview);
}
