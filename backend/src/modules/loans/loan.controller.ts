import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { loanService } from './loan.service';
import { calculateLoanQuote, isWithinLoanLimits, LOAN_LIMITS } from '../../rules/loan.rules';
import { ApiError } from '../../utils/ApiError';
import type { LoanApplicationInput } from '../applications/application.validation';

export const loanController = {
  /** Server-side mirror of the live calculation panel — the client can verify against it. */
  quote: asyncHandler(async (req: Request, res: Response) => {
    const { principal, tenureDays } = req.query as unknown as LoanApplicationInput;
    if (!isWithinLoanLimits(principal, tenureDays)) {
      throw ApiError.badRequest('Loan amount or tenure is outside the permitted range');
    }
    return ok(res, { quote: calculateLoanQuote(principal, tenureDays), limits: LOAN_LIMITS });
  }),

  apply: asyncHandler(async (req: Request, res: Response) => {
    const loan = await loanService.applyForLoan(req.user!.id, req.body as LoanApplicationInput, req);
    return ok(res, { loan }, 201);
  }),

  myLoans: asyncHandler(async (req: Request, res: Response) => {
    const loans = await loanService.listMyLoans(req.user!.id);
    return ok(res, { loans });
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    const loan = await loanService.getLoanForActor(req.params.id as string, {
      id: req.user!.id,
      role: req.user!.role,
    });
    return ok(res, { loan });
  }),
};
