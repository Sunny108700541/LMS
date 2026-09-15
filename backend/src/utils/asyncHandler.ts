import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 does not await async handlers — forward rejections to the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
