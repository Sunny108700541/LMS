import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, paginated } from '../../utils/response';
import { salesService } from './sales.service';
import type { Pagination } from '../../utils/pagination';

export const salesController = {
  leads: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination;
    const { items, total } = await salesService.listLeads(query);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),

  stats: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await salesService.leadStats());
  }),

  analytics: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await salesService.analyticsData());
  }),

  borrowers: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination;
    const { items, total } = await salesService.loanBorrowers(query);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),
};
