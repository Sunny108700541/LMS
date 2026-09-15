import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, paginated } from '../../utils/response';
import { sanctionService } from './sanction.service';
import type { Pagination } from '../../utils/pagination';

export const sanctionController = {
  queue: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination;
    const { items, total } = await sanctionService.queue(query);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const { note } = req.body as { note?: string };
    const loan = await sanctionService.approve(
      req.params.id as string,
      { id: req.user!.id, role: req.user!.role },
      note,
      req,
    );
    return ok(res, { loan });
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body as { reason: string };
    const loan = await sanctionService.reject(
      req.params.id as string,
      { id: req.user!.id, role: req.user!.role },
      reason,
      req,
    );
    return ok(res, { loan });
  }),

  stats: asyncHandler(async (_req: Request, res: Response) => ok(res, await sanctionService.stats())),
};
