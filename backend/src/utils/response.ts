import type { Response } from 'express';

export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

export function paginated<T>(
  res: Response,
  items: T[],
  meta: { page: number; limit: number; total: number },
): Response {
  return res.status(200).json({
    success: true,
    data: items,
    meta: { ...meta, totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)) },
  });
}
