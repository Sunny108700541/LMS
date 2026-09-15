import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and *replaces* the request segment with the parsed result, so
 * downstream handlers work with typed, stripped data — never raw user input.
 */
export const validate =
  (schema: ZodSchema, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || source,
        message: i.message,
      }));
      next(ApiError.badRequest('Validation failed', details));
      return;
    }
    if (source === 'query') {
      // req.query is a getter in Express 4.x for some setups — mutate in place.
      Object.keys(req.query).forEach((k) => delete (req.query as Record<string, unknown>)[k]);
      Object.assign(req.query, result.data);
    } else {
      req[source] = result.data as never;
    }
    next();
  };
