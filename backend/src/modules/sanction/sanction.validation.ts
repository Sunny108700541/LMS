import { z } from 'zod';

export const rejectLoanSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason of at least 10 characters — the borrower will see it')
    .max(500),
});

export const approveLoanSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
