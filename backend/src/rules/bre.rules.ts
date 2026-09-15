import { EmploymentMode } from '../types/enums';

/**
 * Business Rule Engine.
 *
 * Why it lives here and runs on the server: the rules decide whether money is
 * lent, so they are a trust boundary. The client can (and does) run the same
 * checks for instant feedback, but the server's verdict is the only one that is
 * persisted. Nothing in the API accepts a BRE result from the caller.
 */

export const BRE_THRESHOLDS = {
  MIN_AGE: 23,
  MAX_AGE: 50,
  MIN_MONTHLY_SALARY: 25_000,
} as const;

/**
 * Income Tax Department format: 5 letters, 4 digits, 1 letter.
 * The 4th letter encodes holder type and the 5th is the surname initial, but
 * structural validation is what an LMS can assert without an NSDL lookup.
 */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export interface BreInput {
  pan: string;
  dateOfBirth: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  /** Injectable so evaluation is deterministic in tests. */
  referenceDate?: Date;
}

export interface BreFailure {
  rule: 'PAN' | 'AGE' | 'SALARY' | 'EMPLOYMENT';
  message: string;
}

export interface BreResult {
  passed: boolean;
  failures: BreFailure[];
  age: number;
}

/** Completed years, calendar-correct (handles Feb 29 and mid-month birthdays). */
export function calculateAge(dateOfBirth: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = referenceDate.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDelta = referenceDate.getUTCDate() - dateOfBirth.getUTCDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) age -= 1;
  return age;
}

export function evaluateBre(input: BreInput): BreResult {
  const referenceDate = input.referenceDate ?? new Date();
  const failures: BreFailure[] = [];
  const age = calculateAge(input.dateOfBirth, referenceDate);

  if (!PAN_REGEX.test(input.pan.toUpperCase())) {
    failures.push({
      rule: 'PAN',
      message: 'PAN must be 5 letters, 4 digits and 1 letter (e.g. ABCDE1234F).',
    });
  }

  if (age < BRE_THRESHOLDS.MIN_AGE || age > BRE_THRESHOLDS.MAX_AGE) {
    failures.push({
      rule: 'AGE',
      message: `Applicant age must be between ${BRE_THRESHOLDS.MIN_AGE} and ${BRE_THRESHOLDS.MAX_AGE}. Calculated age: ${age}.`,
    });
  }

  if (input.monthlySalary < BRE_THRESHOLDS.MIN_MONTHLY_SALARY) {
    failures.push({
      rule: 'SALARY',
      message: `Monthly salary must be at least ₹${BRE_THRESHOLDS.MIN_MONTHLY_SALARY.toLocaleString('en-IN')}.`,
    });
  }

  if (input.employmentMode === EmploymentMode.UNEMPLOYED) {
    failures.push({
      rule: 'EMPLOYMENT',
      message: 'Unemployed applicants are not eligible for a loan.',
    });
  }

  return { passed: failures.length === 0, failures, age };
}
