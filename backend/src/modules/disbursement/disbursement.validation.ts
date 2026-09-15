import { z } from 'zod';

export const disburseSchema = z.object({
  /** Bank reference for the outgoing transfer. Optional, but recorded when given. */
  transferReference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(500).optional(),
});
