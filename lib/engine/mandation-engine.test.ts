// Ported 1:1 from the canonical .NET legal test suite (LedgerAI.Tests
// MandationEngineTests — 24 cases verified against SI 2026/336 and gov.uk
// qualifying-income guidance, July 2026). If one of these fails after a rules
// change, the law changed — update rules.ts, not the tests, until re-verified.
// Money in pennies.

import { describe, expect, it } from "vitest";
import { assessMandation, type ClientTriageInput } from "./mandation-engine";
import type { QiSourceYear, QiSourceType } from "./qualifying-income";

const TODAY = "2026-07-16";

function client(overrides: Partial<ClientTriageInput> = {}): ClientTriageInput {
  return {
    nino: "QQ123456C",
    isUkResident: true,
    incomeByYear: new Map(),
    ...overrides,
  };
}

function src(
  type: QiSourceType,
  grossPounds: number,
  opts: Partial<QiSourceYear> = {},
): QiSourceYear {
  return {
    type,
    grossIncome: Math.round(grossPounds * 100),
    sharePercent: 100,
    monthsActive: 12,
    ...opts,
  };
}

function withYears(
  c: ClientTriageInput,
  years: Record<number, QiSourceYear[]>,
): ClientTriageInput {
  c.incomeByYear = new Map(Object.entries(years).map(([y, s]) => [Number(y), s]));
  return c;
}

describe("gross, not profit", () => {
  it("landlord with £51k rents and high costs is mandated on gross rents", () => {
    const a = assessMandation(
      withYears(client(), { 2024: [src("uk-property", 51_000)] }), TODAY);
    expect(a.status).toBe("mandated");
    expect(a.wave).toBe("wave1-2026");
    expect(a.mandatedFrom).toBe("2026-04-06");
  });

  it("trader with £55k turnover and low profit is mandated on turnover", () => {
    const a = assessMandation(
      withYears(client(), { 2024: [src("self-employment", 55_000)] }), TODAY);
    expect(a.status).toBe("mandated");
    expect(a.wave).toBe("wave1-2026");
  });
});

describe("exclusions", () => {
  it("£200k dividends + £10k rents is NOT mandated", () => {
    const a = assessMandation(withYears(client(), {
      2024: [src("dividends", 200_000), src("uk-property", 10_000)],
    }), TODAY);
    expect(a.status).toBe("not-mandated");
    expect(a.yearlyIncome[0].total).toBe(1_000_000);
  });

  it("partnership share is excluded (SA104)", () => {
    const a = assessMandation(withYears(client(), {
      2024: [src("partnership-share", 100_000), src("uk-property", 5_000)],
    }), TODAY);
    expect(a.status).toBe("not-mandated");
  });

  it("trade and property aggregate per person: £28k + £26k = £54k → wave 1", () => {
    const a = assessMandation(withYears(client(), {
      2024: [src("self-employment", 28_000), src("uk-property", 26_000)],
    }), TODAY);
    expect(a.status).toBe("mandated");
    expect(a.wave).toBe("wave1-2026");
  });
});

describe("joint property", () => {
  it("counts beneficial share only: £80k joint 50/50 → £40k each, wave 2 via 2025-26", () => {
    const c = withYears(client(), {
      2024: [src("uk-property", 80_000, { sharePercent: 50 })],
    });
    const wave1 = assessMandation(c, TODAY);
    expect(wave1.status).toBe("not-mandated");
    expect(wave1.yearlyIncome[0].total).toBe(4_000_000);

    c.incomeByYear.set(2025, [src("uk-property", 80_000, { sharePercent: 50 })]);
    const wave2 = assessMandation(c, TODAY);
    expect(wave2.status).toBe("mandated");
    expect(wave2.wave).toBe("wave2-2027");
    expect(wave2.mandatedFrom).toBe("2027-04-06");
  });
});

describe("annualisation", () => {
  it("7-month landlord with £31k rents annualises above £50k → wave 1", () => {
    const a = assessMandation(withYears(client(), {
      2024: [src("uk-property", 31_000, { monthsActive: 7 })],
    }), TODAY);
    expect(a.status).toBe("mandated");
    expect(a.yearlyIncome[0].total).toBe(Math.round((3_100_000 * 12) / 7));
  });

  it("alternative method skips annualisation and flags manual review", () => {
    const a = assessMandation(withYears(client(), {
      2024: [src("uk-property", 31_000, { monthsActive: 7, altAnnualisation: true })],
    }), TODAY);
    expect(a.status).toBe("not-mandated");
    expect(a.requiresManualReview).toBe(true);
  });
});

describe("waves and thresholds", () => {
  it.each([
    [2024, 50_001, "wave1-2026"],
    [2025, 30_001, "wave2-2027"],
    [2026, 20_001, "wave3-2028plus"],
  ])("look-back %i at £%i maps to %s", (year, pounds, wave) => {
    const a = assessMandation(
      withYears(client(), { [year]: [src("self-employment", pounds as number)] }), TODAY);
    expect(a.status).toBe("mandated");
    expect(a.wave).toBe(wave);
  });

  it("exactly at the threshold is NOT over it", () => {
    const a = assessMandation(
      withYears(client(), { 2024: [src("self-employment", 50_000)] }), TODAY);
    expect(a.status).toBe("not-mandated");
  });

  it("waves tighten year on year: £40k misses wave 1, crosses £30k for wave 2", () => {
    const a = assessMandation(withYears(client(), {
      2024: [src("self-employment", 40_000)],
      2025: [src("self-employment", 40_000)],
    }), TODAY);
    expect(a.wave).toBe("wave2-2027");
  });
});

describe("exemptions and deferrals", () => {
  it("minister of religion is exempt regardless of income", () => {
    const a = assessMandation(withYears(client({ isMinisterOfReligion: true }), {
      2024: [src("self-employment", 90_000)],
    }), TODAY);
    expect(a.status).toBe("exempt");
    expect(a.exemption).toBe("minister-of-religion");
  });

  it("no NINO is exempt", () => {
    const a = assessMandation(withYears(client({ nino: null }), {
      2024: [src("self-employment", 90_000)],
    }), TODAY);
    expect(a.status).toBe("exempt");
    expect(a.exemption).toBe("no-nino");
  });

  it("SA109 filer over £50k in 2024-25 is deferred, NOT wave 1", () => {
    const a = assessMandation(withYears(client({ filesSa109: true }), {
      2024: [src("uk-property", 60_000)],
    }), TODAY);
    expect(a.status).toBe("deferred-to-april-2027");
  });

  it("deferred + 2025-26 over £30k joins April 2027", () => {
    const a = assessMandation(withYears(client({ filesSa109: true }), {
      2024: [src("uk-property", 60_000)],
      2025: [src("uk-property", 60_000)],
    }), TODAY);
    expect(a.status).toBe("mandated");
    expect(a.wave).toBe("wave2-2027");
    expect(a.mandatedFrom).toBe("2027-04-06");
  });

  it("foster carer's qualifying care receipts do not count", () => {
    const a = assessMandation(
      withYears(client({ receivesQualifyingCareRelief: true }), {
        2024: [src("qualifying-care", 55_000)],
      }), TODAY);
    expect(a.status).not.toBe("mandated");
  });
});

describe("non-residents", () => {
  it("non-resident's foreign property is excluded", () => {
    const a = assessMandation(withYears(client({ isUkResident: false }), {
      2024: [src("foreign-property", 70_000), src("uk-property", 20_000)],
    }), TODAY);
    expect(a.status).toBe("not-mandated");
    expect(a.yearlyIncome[0].total).toBe(2_000_000);
  });

  it("UK resident's foreign property IS counted", () => {
    const a = assessMandation(withYears(client(), {
      2024: [src("foreign-property", 51_000)],
    }), TODAY);
    expect(a.status).toBe("mandated");
  });
});

describe("exit rule (three consecutive years IN MTD; audit-corrected)", () => {
  it("pre-MTD look-back years do not count toward the run", () => {
    const c = withYears(client(), {
      2024: [src("self-employment", 60_000)], // trigger → mandated Apr 2026
      2025: [src("self-employment", 15_000)], // pre-MTD: must not count
      2026: [src("self-employment", 15_000)], // MTD year 1
      2027: [src("self-employment", 15_000)], // MTD year 2
    });
    expect(assessMandation(c, "2029-06-01").status).toBe("mandated");

    c.incomeByYear.set(2028, [src("self-employment", 15_000)]); // MTD year 3
    expect(assessMandation(c, "2030-06-01").status).toBe("opt-out-eligible");
  });

  it("a missing year of data breaks the consecutive run", () => {
    const c = withYears(client(), {
      2024: [src("self-employment", 60_000)],
      2026: [src("self-employment", 15_000)],
      // 2027 missing entirely
      2028: [src("self-employment", 15_000)],
      2029: [src("self-employment", 15_000)],
    });
    const a = assessMandation(c, "2031-06-01");
    expect(a.status).toBe("mandated");
    expect(a.reasons.join(" ")).toMatch(/gap|Missing tax year/i);
  });

  it("permanent cessation bypasses the exit rule", () => {
    const c = withYears(client({ ceasedAllSourcesOn: "2026-09-30" }), {
      2024: [src("self-employment", 60_000)],
    });
    const a = assessMandation(c, "2026-10-01");
    expect(a.status).toBe("ceased");
    expect(a.reasons.join(" ")).toContain("2026-27");
  });
});

describe("rounding parity with the .NET engine (banker's rounding)", () => {
  it("half-penny midpoints round to even — £100,000.01 at 50% share is NOT mandated", () => {
    // 10,000,001p × 50% = 5,000,000.5p → ToEven → 5,000,000 = exactly £50,000,
    // which is NOT over the threshold (strict greater-than). The .NET engine
    // agrees; naive Math.round would flip this verdict.
    const a = assessMandation(withYears(client(), {
      2024: [{ type: "uk-property", grossIncome: 10_000_001, sharePercent: 50, monthsActive: 12 }],
    }), TODAY);
    expect(a.status).toBe("not-mandated");
    expect(a.yearlyIncome[0].total).toBe(5_000_000);
  });
});

describe("voluntary and unassessed", () => {
  it("below threshold + voluntary sign-up is voluntary", () => {
    const a = assessMandation(
      withYears(client({ voluntarilySignedUp: true }), {
        2024: [src("self-employment", 12_000)],
      }), TODAY);
    expect(a.status).toBe("voluntary");
  });

  it("no income data is not-assessed", () => {
    expect(assessMandation(client(), TODAY).status).toBe("not-assessed");
  });

  it("assessments always carry reasons (explainability)", () => {
    const a = assessMandation(
      withYears(client(), { 2024: [src("uk-property", 51_000)] }), TODAY);
    expect(a.reasons.length).toBeGreaterThan(0);
  });
});
