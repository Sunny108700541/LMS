import { EmploymentMode } from '../types/enums';

/**
 * Business Rule Engine.
 
 */

export const BRE_THRESHOLDS = {
  MIN_AGE: 23,
  MAX_AGE: 50,
  MIN_MONTHLY_SALARY: 25_000,
} as const;


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
