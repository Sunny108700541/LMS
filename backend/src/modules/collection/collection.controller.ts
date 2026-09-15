import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, paginated } from '../../utils/response';
import { collectionService } from './collection.service';
import type { Pagination } from '../../utils/pagination';
import type { RecordPaymentInput } from './collection.validation';

export const collectionController = {
  queue: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Pagination;
    const { items, total } = await collectionService.queue(query);
    return paginated(res, items, { page: query.page, limit: query.limit, total });
  }),

  payments: asyncHandler(async (req: Request, res: Response) => {
    const payments = await collectionService.listPayments(req.params.id as string);
    return ok(res, { payments });
  }),

  recordPayment: asyncHandler(async (req: Request, res: Response) => {
    const result = await collectionService.recordPayment(
      req.params.id as string,
      req.body as RecordPaymentInput,
      { id: req.user!.id, role: req.user!.role },
      req,
    );
    return ok(res, result, 201);
  }),

  stats: asyncHandler(async (_req: Request, res: Response) =>
    ok(res, await collectionService.stats()),
  ),
};
