export const LOAN_LIMITS = {
  MIN_PRINCIPAL: 50_000,
  MAX_PRINCIPAL: 500_000,
  PRINCIPAL_STEP: 5_000,
  MIN_TENURE_DAYS: 30,
  MAX_TENURE_DAYS: 365,
  TENURE_STEP: 1,
  ANNUAL_INTEREST_RATE: 12,
  DAYS_IN_YEAR: 365,
} as const;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Mirror of the server calculation so the slider panel updates instantly.
 * The figures that get stored are always the server's — this is display only.
 */
export function calculateQuote(principal: number, tenureDays: number) {
  const simpleInterest = round2(
    (principal * LOAN_LIMITS.ANNUAL_INTEREST_RATE * tenureDays) / (LOAN_LIMITS.DAYS_IN_YEAR * 100),
  );
  return {
    principal: round2(principal),
    tenureDays,
    interestRate: LOAN_LIMITS.ANNUAL_INTEREST_RATE,
    simpleInterest,
    totalRepayment: round2(principal + simpleInterest),
  };
}
