import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, paginated } from '../../utils/response';
import { adminService } from './admin.service';
import { authService } from '../auth/auth.service';
import type { CreateUserInput } from '../auth/auth.validation';
import type { Pagination } from '../../utils/pagination';
import type { LoanStatus, Role } from '../../types/enums';

export const adminController = {
  createUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.createUser(req.body as CreateUserInput, req.user!.id, req);
    return ok(res, { user }, 201);
  }),

  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination & { role?: Role };
    const { items, total } = await adminService.listUsers(query, query.role);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),

  setUserActive: asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body as { isActive: boolean };
    const user = await adminService.setUserActive(
      req.params.id as string,
      isActive,
      req.user!.id,
      req,
    );
    return ok(res, { user });
  }),

  overview: asyncHandler(async (_req: Request, res: Response) => ok(res, await adminService.overview())),

  auditLogs: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination;
    const { items, total } = await adminService.listAuditLogs(query);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),

  loans: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination & { status?: LoanStatus };
    const { items, total } = await adminService.listAllLoans(query, query.status);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),
};
