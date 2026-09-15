import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { applicationService } from './application.service';
import type { PersonalDetailsInput } from './application.validation';

export const applicationController = {
  submitPersonalDetails: asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.submitPersonalDetails(
      req.user!.id,
      req.body as PersonalDetailsInput,
      req,
    );
    return ok(res, { application: result.application }, 201);
  }),

  uploadSalarySlip: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('Attach a salary slip to continue');
    const result = await applicationService.uploadSalarySlip(
      req.user!.id,
      req.params.id as string,
      req.file,
      req,
    );
    return ok(res, result, 201);
  }),

  myApplication: asyncHandler(async (req: Request, res: Response) => {
    const application = await applicationService.getMyApplication(req.user!.id);
    return ok(res, { application });
  }),

  myApplicationHistory: asyncHandler(async (req: Request, res: Response) => {
    const applications = await applicationService.getApplicationHistory(req.user!.id);
    return ok(res, { applications });
  }),

  documentUrl: asyncHandler(async (req: Request, res: Response) => {
    const data = await applicationService.getDocumentUrl(
      req.params.id as string,
      { id: req.user!.id, role: req.user!.role },
      req,
    );
    return ok(res, data);
  }),
};
