import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, paginated } from '../../utils/response';
import { disbursementService } from './disbursement.service';
import type { Pagination } from '../../utils/pagination';

export const disbursementController = {
  queue: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination;
    const { items, total } = await disbursementService.queue(query);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),

  disburse: asyncHandler(async (req: Request, res: Response) => {
    const loan = await disbursementService.disburse(
      req.params.id as string,
      { id: req.user!.id, role: req.user!.role },
      req.body as { transferReference?: string; note?: string },
      req,
    );
    return ok(res, { loan });
  }),

  stats: asyncHandler(async (_req: Request, res: Response) =>
    ok(res, await disbursementService.stats()),
  ),
};
