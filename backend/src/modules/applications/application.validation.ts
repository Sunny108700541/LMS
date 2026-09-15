import { z } from 'zod';
import { EmploymentMode } from '../../types/enums';
import { PAN_REGEX } from '../../rules/bre.rules';
import { LOAN_LIMITS } from '../../rules/loan.rules';

export const personalDetailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, 'PAN must look like ABCDE1234F'),
  dateOfBirth: z.coerce
    .date()
    .refine((d) => d < new Date(), { message: 'Date of birth must be in the past' })
    .refine((d) => d > new Date('1920-01-01'), { message: 'Enter a valid date of birth' }),
  monthlySalary: z.coerce
    .number()
    .int('Enter salary in whole rupees')
    .min(0, 'Salary cannot be negative')
    .max(100_000_000, 'Enter a realistic monthly salary'),
  employmentMode: z.nativeEnum(EmploymentMode, {
    errorMap: () => ({ message: 'Select an employment mode' }),
  }),
});

export const loanApplicationSchema = z.object({
  principal: z.coerce
    .number()
    .min(LOAN_LIMITS.MIN_PRINCIPAL, `Minimum loan amount is ₹${LOAN_LIMITS.MIN_PRINCIPAL}`)
    .max(LOAN_LIMITS.MAX_PRINCIPAL, `Maximum loan amount is ₹${LOAN_LIMITS.MAX_PRINCIPAL}`),
  tenureDays: z.coerce
    .number()
    .int()
    .min(LOAN_LIMITS.MIN_TENURE_DAYS, `Minimum tenure is ${LOAN_LIMITS.MIN_TENURE_DAYS} days`)
    .max(LOAN_LIMITS.MAX_TENURE_DAYS, `Maximum tenure is ${LOAN_LIMITS.MAX_TENURE_DAYS} days`),
});

export const quoteQuerySchema = loanApplicationSchema;

export const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier'),
});

export type PersonalDetailsInput = z.infer<typeof personalDetailsSchema>;
export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;
