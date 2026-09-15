import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';
import { LoanStatus, Role } from '../../types/enums';

export const setActiveSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive is required' }),
});

export const listUsersQuerySchema = paginationSchema.extend({
  role: z.nativeEnum(Role).optional(),
});

export const listLoansQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(LoanStatus).optional(),
});
