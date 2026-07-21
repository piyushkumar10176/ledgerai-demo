import { one, many, run } from "./db";
import { computeTaxProjection, type TaxInputs, type TaxResult } from "./tax";
import { TAX_YEAR, TAX_YEAR_START } from "./periods";
import { logAudit } from "./audit";

const YEAR_END = "2027-04-05";

export interface YearEndData {
  employment_income: number; employment_tax_paid: number; dividends: number; interest: number;
  pension_income: number; pension_contributions: number; gift_aid: number;
  student_loan_plan: string | null; hicbc: number; capital_allowances: number; disallowables: number;
  declared_at: string | null;
}

const EMPTY: YearEndData = {
  employment_income: 0, employment_tax_paid: 0, dividends: 0, interest: 0,
  pension_income: 0, pension_contributions: 0, gift_aid: 0,
  student_loan_plan: null, hicbc: 0, capital_allowances: 0, disallowables: 0, declared_at: null,
};

export async function getYearEndData(clientId: number, taxYear = TAX_YEAR): Promise<YearEndData> {
  const row = await one<YearEndData>(
    `SELECT employment_income, employment_tax_paid, dividends, interest, pension_income,
            pension_contributions, gift_aid, student_loan_plan, hicbc, capital_allowances,
            disallowables, declared_at
       FROM year_end_data WHERE client_id = ? AND tax_year = ?`,
    [clientId, taxYear],
  );
  return row ?? EMPTY;
}

export async function saveYearEndData(
  firmId: number, clientId: number, f: Partial<YearEndData>, taxYear = TAX_YEAR,
): Promise<void> {
  const cur = await getYearEndData(clientId, taxYear);
  const v = { ...cur, ...f };
  await run(
    `INSERT INTO year_end_data
       (firm_id, client_id, tax_year, employment_income, employment_tax_paid, dividends, interest,
        pension_income, pension_contributions, gift_aid, student_loan_plan, hicbc,
        capital_allowances, disallowables, declared_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_id, tax_year) DO UPDATE SET
       employment_income=excluded.employment_income, employment_tax_paid=excluded.employment_tax_paid,
       dividends=excluded.dividends, interest=excluded.interest, pension_income=excluded.pension_income,
       pension_contributions=excluded.pension_contributions, gift_aid=excluded.gift_aid,
       student_loan_plan=excluded.student_loan_plan, hicbc=excluded.hicbc,
       capital_allowances=excluded.capital_allowances, disallowables=excluded.disallowables,
       declared_at=excluded.declared_at`,
    [firmId, clientId, taxYear, v.employment_income, v.employment_tax_paid, v.dividends, v.interest,
     v.pension_income, v.pension_contributions, v.gift_aid, v.student_loan_plan, v.hicbc,
     v.capital_allowances, v.disallowables, v.declared_at],
  );
  await logAudit(firmId, "yearend.saved", "client", clientId, taxYear);
}

// Business profits for the tax year, split self-employment vs property.
export async function businessProfits(clientId: number): Promise<{ trading: number; property: number }> {
  const rows = await many<{ type: string; direction: string; total: number }>(
    `SELECT s.type, t.direction, COALESCE(SUM(t.amount),0) AS total
       FROM transactions t JOIN income_sources s ON s.id = t.income_source_id
      WHERE t.client_id = ? AND t.status IN ('auto','confirmed')
        AND t.txn_date >= ? AND t.txn_date <= ?
      GROUP BY s.type, t.direction`,
    [clientId, TAX_YEAR_START, YEAR_END],
  );
  const sum = (type: string, dir: string) => rows.find((r) => r.type === type && r.direction === dir)?.total ?? 0;
  return {
    trading: sum("self-employment", "income") - sum("self-employment", "expense"),
    property: sum("uk-property", "income") - sum("uk-property", "expense"),
  };
}

export async function clientTaxProjection(clientId: number, taxYear = TAX_YEAR): Promise<{ result: TaxResult; inputs: TaxInputs }> {
  const [p, y] = await Promise.all([businessProfits(clientId), getYearEndData(clientId, taxYear)]);
  const inputs: TaxInputs = {
    tradingProfit: p.trading, propertyProfit: p.property,
    employmentIncome: y.employment_income, employmentTaxPaid: y.employment_tax_paid,
    pensionIncome: y.pension_income, dividends: y.dividends, interest: y.interest,
    pensionContributions: y.pension_contributions, giftAid: y.gift_aid,
    studentLoanPlan: y.student_loan_plan, hicbc: y.hicbc,
    capitalAllowances: y.capital_allowances, disallowables: y.disallowables,
  };
  return { result: computeTaxProjection(inputs), inputs };
}
