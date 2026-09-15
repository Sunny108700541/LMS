import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}

/**
 * Single exit point for every failure. Known errors keep their message;
 * anything unexpected is logged in full and returned as a generic 500 so
 * internals (driver messages, stack traces, keys) never reach a client.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'Something went wrong. Please try again.';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid value for '${err.path}'`;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    message = duplicateKeyMessage(err);
  }

  if (statusCode >= 500) {
    logger.error('unhandled error', { requestId: req.requestId, err });
  } else {
    logger.warn('handled error', { requestId: req.requestId, code, message });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: req.requestId,
      ...(env.isProd || !(err instanceof Error) ? {} : { stack: undefined }),
    },
  });
}

function isDuplicateKeyError(err: unknown): err is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

function duplicateKeyMessage(err: { keyPattern?: Record<string, unknown> }): string {
  const field = Object.keys(err.keyPattern ?? {})[0];
  switch (field) {
    case 'email':
      return 'An account with this email already exists';
    case 'utrNumber':
      return 'This UTR number has already been recorded';
    case 'role':
      return 'An admin account already exists';
    default:
      return 'This record already exists';
  }
}
