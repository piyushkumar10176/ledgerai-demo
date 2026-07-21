// Deterministic UK income-tax projection (2026/27 thresholds).
// NOTE: HMRC's Individual Calculations API is authoritative for a real filing —
// this is an in-app ESTIMATE for planning/advice, computed in code, never by AI.
// All money in PENNIES.

export const TAX_RULES_VERSION = "2026-27.v1";

const PERSONAL_ALLOWANCE = 1_257_000;      // £12,570
const PA_TAPER_START = 10_000_000;         // £100,000
const BASIC_BAND = 3_770_000;              // £37,700 above PA
const HIGHER_LIMIT = 12_514_000;           // £125,140
const BASIC_RATE = 0.2, HIGHER_RATE = 0.4, ADDITIONAL_RATE = 0.45;

const DIV_ALLOWANCE = 50_000;              // £500
const DIV_BASIC = 0.0875, DIV_HIGHER = 0.3375, DIV_ADDITIONAL = 0.3935;
const PSA_BASIC = 100_000, PSA_HIGHER = 50_000; // savings allowance

// Class 4 NIC (self-employment profits)
const NIC4_LOWER = 1_257_000, NIC4_UPPER = 5_027_000;
const NIC4_MAIN = 0.06, NIC4_UPPER_RATE = 0.02;

const STUDENT_LOAN: Record<string, { threshold: number; rate: number }> = {
  plan1: { threshold: 2_499_000, rate: 0.09 },
  plan2: { threshold: 2_729_500, rate: 0.09 },
  plan4: { threshold: 3_139_500, rate: 0.09 },
  plan5: { threshold: 2_500_000, rate: 0.09 },
  postgrad: { threshold: 2_100_000, rate: 0.06 },
};

export interface TaxInputs {
  tradingProfit: number;      // self-employment net profit
  propertyProfit: number;     // UK property net profit
  employmentIncome: number;
  employmentTaxPaid: number;
  pensionIncome: number;
  dividends: number;
  interest: number;
  pensionContributions: number; // gross personal contributions (extends basic band)
  giftAid: number;              // gross
  studentLoanPlan?: string | null;
  hicbc: number;                // High Income Child Benefit Charge
  capitalAllowances: number;
  disallowables: number;
}

export interface TaxResult {
  version: string;
  totalIncome: number;
  personalAllowance: number;
  taxableIncome: number;
  incomeTax: number;
  dividendTax: number;
  savingsTax: number;
  class4Nic: number;
  studentLoan: number;
  hicbc: number;
  totalDue: number;          // after employment tax already paid
  breakdown: { label: string; amount: number }[];
}

export function computeTaxProjection(i: TaxInputs): TaxResult {
  // Adjusted trading profit
  const trading = Math.max(0, i.tradingProfit + i.disallowables - i.capitalAllowances);
  const nonSavings = trading + Math.max(0, i.propertyProfit) + i.employmentIncome + i.pensionIncome;
  const totalIncome = nonSavings + i.dividends + i.interest;

  // Personal allowance, tapered £1 for every £2 over £100k
  let pa = PERSONAL_ALLOWANCE;
  if (totalIncome > PA_TAPER_START) pa = Math.max(0, PERSONAL_ALLOWANCE - Math.floor((totalIncome - PA_TAPER_START) / 2));

  // Basic band extended by gross pension contributions + gift aid
  const bandExtension = i.pensionContributions + i.giftAid;
  const basicTop = BASIC_BAND + bandExtension;

  // --- non-savings income tax ---
  const taxableNonSavings = Math.max(0, nonSavings - pa);
  let incomeTax = 0;
  const basicPart = Math.min(taxableNonSavings, basicTop);
  incomeTax += basicPart * BASIC_RATE;
  const higherPart = Math.min(Math.max(0, taxableNonSavings - basicTop), Math.max(0, HIGHER_LIMIT - pa - basicTop));
  incomeTax += higherPart * HIGHER_RATE;
  const addPart = Math.max(0, taxableNonSavings - basicTop - higherPart);
  incomeTax += addPart * ADDITIONAL_RATE;

  // --- savings interest (PSA depends on marginal band) ---
  const isHigher = taxableNonSavings > basicTop;
  const isAdditional = taxableNonSavings > HIGHER_LIMIT - pa;
  const psa = isAdditional ? 0 : isHigher ? PSA_HIGHER : PSA_BASIC;
  const taxableInterest = Math.max(0, i.interest - psa);
  const savingsRate = isAdditional ? ADDITIONAL_RATE : isHigher ? HIGHER_RATE : BASIC_RATE;
  const savingsTax = taxableInterest * savingsRate;

  // --- dividends ---
  const taxableDiv = Math.max(0, i.dividends - DIV_ALLOWANCE);
  const divRate = isAdditional ? DIV_ADDITIONAL : isHigher ? DIV_HIGHER : DIV_BASIC;
  const dividendTax = taxableDiv * divRate;

  // --- Class 4 NIC on trading profit ---
  const nicBase = Math.max(0, trading);
  const class4Nic =
    Math.max(0, Math.min(nicBase, NIC4_UPPER) - NIC4_LOWER) * NIC4_MAIN +
    Math.max(0, nicBase - NIC4_UPPER) * NIC4_UPPER_RATE;

  // --- student loan ---
  const plan = i.studentLoanPlan && STUDENT_LOAN[i.studentLoanPlan];
  const studentLoan = plan ? Math.max(0, totalIncome - plan.threshold) * plan.rate : 0;

  const gross = incomeTax + savingsTax + dividendTax + class4Nic + studentLoan + i.hicbc;
  const totalDue = Math.round(gross - i.employmentTaxPaid);

  const r = (n: number) => Math.round(n);
  return {
    version: TAX_RULES_VERSION,
    totalIncome, personalAllowance: pa,
    taxableIncome: taxableNonSavings,
    incomeTax: r(incomeTax), dividendTax: r(dividendTax), savingsTax: r(savingsTax),
    class4Nic: r(class4Nic), studentLoan: r(studentLoan), hicbc: i.hicbc,
    totalDue,
    breakdown: [
      { label: "Income tax (non-savings)", amount: r(incomeTax) },
      { label: "Savings interest tax", amount: r(savingsTax) },
      { label: "Dividend tax", amount: r(dividendTax) },
      { label: "Class 4 NIC", amount: r(class4Nic) },
      { label: "Student loan", amount: r(studentLoan) },
      { label: "High Income Child Benefit Charge", amount: i.hicbc },
      { label: "Less: tax already paid (PAYE)", amount: -i.employmentTaxPaid },
    ].filter((b) => b.amount !== 0),
  };
}
