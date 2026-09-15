import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { authService } from './auth.service';
import type { BootstrapAdminInput, LoginInput, RegisterInput } from './auth.validation';

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.register(req.body as RegisterInput, req, res);
    return ok(res, { user }, 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.login(req.body as LoginInput, req, res);
    return ok(res, { user });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.refresh(req, res);
    return ok(res, { user });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req, res);
    return ok(res, { message: 'Signed out' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getProfile(req.user!.id);
    return ok(res, { user });
  }),

  bootstrapAdmin: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.bootstrapAdmin(req.body as BootstrapAdminInput, req);
    return ok(res, { user }, 201);
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    return ok(res, { message: 'Password updated. Please sign in again.' });
  }),
};
