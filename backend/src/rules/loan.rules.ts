/**
 * Loan arithmetic. Pure functions, no I/O — the same numbers the borrower sees
 * on the slider panel are the numbers the server persists.
 */

export const LOAN_LIMITS = {
  MIN_PRINCIPAL: 50_000,
  MAX_PRINCIPAL: 500_000,
  MIN_TENURE_DAYS: 30,
  MAX_TENURE_DAYS: 365,
  ANNUAL_INTEREST_RATE: 12,
  DAYS_IN_YEAR: 365,
} as const;

export interface LoanQuote {
  principal: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
}

/** Money is rounded to 2 decimals at the point of calculation, never accumulated raw. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * SI = (P × R × T) / (365 × 100), T in days.
 * Total repayment = P + SI.
 */
export function calculateLoanQuote(principal: number, tenureDays: number): LoanQuote {
  const rate = LOAN_LIMITS.ANNUAL_INTEREST_RATE;
  const simpleInterest = round2(
    (principal * rate * tenureDays) / (LOAN_LIMITS.DAYS_IN_YEAR * 100),
  );
  return {
    principal: round2(principal),
    tenureDays,
    interestRate: rate,
    simpleInterest,
    totalRepayment: round2(principal + simpleInterest),
  };
}

export function isWithinLoanLimits(principal: number, tenureDays: number): boolean {
  return (
    principal >= LOAN_LIMITS.MIN_PRINCIPAL &&
    principal <= LOAN_LIMITS.MAX_PRINCIPAL &&
    tenureDays >= LOAN_LIMITS.MIN_TENURE_DAYS &&
    tenureDays <= LOAN_LIMITS.MAX_TENURE_DAYS
  );
}

/** Tolerance for float noise when deciding "fully repaid" (half a paisa). */
export const SETTLEMENT_EPSILON = 0.005;

export function roundMoney(value: number): number {
  return round2(value);
}
