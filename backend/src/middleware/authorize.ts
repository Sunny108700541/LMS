import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { Role } from '../types/enums';

/**
 * Role gate. Hiding a menu item is cosmetic; this is the actual control.
 * 401 = not authenticated, 403 = authenticated but not permitted.
 * ADMIN is implicitly allowed on every executive route.
 */
export const authorize =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    const permitted = allowed.includes(req.user.role) || req.user.role === Role.ADMIN;
    if (!permitted) {
      next(ApiError.forbidden(`This action requires one of: ${allowed.join(', ')}`));
      return;
    }
    next();
  };

/** Admin-only routes, where the implicit admin escalation above is not wanted. */
export const adminOnly = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== Role.ADMIN) return next(ApiError.forbidden('Admin access required'));
  next();
};
