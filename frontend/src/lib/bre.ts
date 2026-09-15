import type { EmploymentMode } from './types';

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const BRE_THRESHOLDS = {
  MIN_AGE: 23,
  MAX_AGE: 50,
  MIN_MONTHLY_SALARY: 25_000,
} as const;

export function calculateAge(dateOfBirth: Date, reference: Date = new Date()): number {
  let age = reference.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = reference.getMonth() - dateOfBirth.getMonth();
  const dayDelta = reference.getDate() - dateOfBirth.getDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) age -= 1;
  return age;
}

/**
 * Client-side copy of the rules, for immediate feedback while typing.
 * It is a convenience only — the server runs the same checks and its verdict
 * is the one that decides the application.
 */
export function previewEligibility(input: {
  pan: string;
  dateOfBirth: string;
  monthlySalary: number;
  employmentMode: EmploymentMode | '';
}): { rule: string; message: string }[] {
  const failures: { rule: string; message: string }[] = [];

  if (input.pan && !PAN_REGEX.test(input.pan.toUpperCase())) {
    failures.push({ rule: 'PAN', message: 'PAN must look like ABCDE1234F.' });
  }

  if (input.dateOfBirth) {
    const age = calculateAge(new Date(input.dateOfBirth));
    if (age < BRE_THRESHOLDS.MIN_AGE || age > BRE_THRESHOLDS.MAX_AGE) {
      failures.push({
        rule: 'AGE',
        message: `Age must be between ${BRE_THRESHOLDS.MIN_AGE} and ${BRE_THRESHOLDS.MAX_AGE}. Yours is ${age}.`,
      });
    }
  }

  if (input.monthlySalary > 0 && input.monthlySalary < BRE_THRESHOLDS.MIN_MONTHLY_SALARY) {
    failures.push({
      rule: 'SALARY',
      message: `Monthly salary must be at least ₹${BRE_THRESHOLDS.MIN_MONTHLY_SALARY.toLocaleString('en-IN')}.`,
    });
  }

  if (input.employmentMode === 'UNEMPLOYED') {
    failures.push({ rule: 'EMPLOYMENT', message: 'Unemployed applicants are not eligible.' });
  }

  return failures;
}
