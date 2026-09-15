import { z } from 'zod';

export const recordPaymentSchema = z.object({
  /**
   * NEFT/RTGS/IMPS/UPI references are alphanumeric. 12–22 characters covers the
   * formats Indian banks issue; uniqueness is enforced by the database.
   */
  utrNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8,32}$/, 'UTR must be 8–32 letters or digits'),
  amount: z.coerce
    .number()
    .positive('Payment amount must be greater than zero')
    .max(10_000_000, 'Payment amount looks incorrect'),
  paidAt: z.coerce
    .date()
    .refine((d) => d <= new Date(), { message: 'Payment date cannot be in the future' }),
  note: z.string().trim().max(300).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
