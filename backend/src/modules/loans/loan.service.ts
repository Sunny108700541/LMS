import type { Request } from 'express';
import mongoose, { type FilterQuery } from 'mongoose';
import { Loan, type ILoan } from '../../models/Loan.model';
import { Application } from '../../models/Application.model';
import { ApiError } from '../../utils/ApiError';
import { ApplicationStatus, AuditAction, LoanStatus, Role } from '../../types/enums';
import { calculateLoanQuote, isWithinLoanLimits } from '../../rules/loan.rules';
import { canTransition, roleCanTransition } from '../../rules/loanStatus.rules';
import { auditService } from '../audit/audit.service';
import type { LoanApplicationInput } from '../applications/application.validation';

/** Human-friendly reference, e.g. LN-2026-0007AB3C. */
function buildLoanRef(): string {
  const year = new Date().getFullYear();
  const suffix = new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase();
  return `LN-${year}-${suffix}`;
}

export interface LoanListFilters {
  status?: LoanStatus | LoanStatus[];
  search?: string;
  page: number;
  limit: number;
}

/**
 * Step 4 — raise the loan.
 *
 * Interest is recomputed here from principal and tenure alone. Any amounts the
 * client sends are treated as display values and ignored.
 */
export async function applyForLoan(
  userId: string,
  input: LoanApplicationInput,
  req: Request,
): Promise<ILoan> {
  if (!isWithinLoanLimits(input.principal, input.tenureDays)) {
    throw ApiError.badRequest('Loan amount or tenure is outside the permitted range');
  }

  const application = await Application.findOne({
    userId,
    status: ApplicationStatus.DOCUMENT_UPLOADED,
  });

  if (!application) {
    throw ApiError.unprocessable(
      'Complete your personal details and upload a salary slip before applying',
    );
  }
  if (!application.bre.passed) {
    throw ApiError.forbidden('This application did not pass the eligibility check');
  }

  const openLoan = await Loan.findOne({
    userId,
    status: { $in: [LoanStatus.APPLIED, LoanStatus.SANCTIONED, LoanStatus.DISBURSED] },
  }).select('_id');
  if (openLoan) throw ApiError.conflict('You already have an active loan');

  const quote = calculateLoanQuote(input.principal, input.tenureDays);

  const loan = await Loan.create({
    loanRef: buildLoanRef(),
    userId,
    applicationId: application._id,
    principal: quote.principal,
    tenureDays: quote.tenureDays,
    interestRate: quote.interestRate,
    simpleInterest: quote.simpleInterest,
    totalRepayment: quote.totalRepayment,
    amountPaid: 0,
    outstanding: quote.totalRepayment,
    status: LoanStatus.APPLIED,
    appliedAt: new Date(),
  });

  application.status = ApplicationStatus.SUBMITTED;
  application.submittedAt = new Date();
  await application.save();

  await auditService.record({
    action: AuditAction.LOAN_APPLIED,
    entityType: 'Loan',
    entityId: loan._id.toString(),
    metadata: { principal: quote.principal, tenureDays: quote.tenureDays },
    req,
  });

  return loan.toObject() as ILoan;
}

export async function listLoans(filters: LoanListFilters) {
  const query: FilterQuery<ILoan> = {};
  if (filters.status) {
    query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
  }
  if (filters.search) {
    query.loanRef = { $regex: filters.search.trim(), $options: 'i' };
  }

  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await Promise.all([
    Loan.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .populate('userId', 'fullName email phone')
      .populate('applicationId', 'fullName panMasked monthlySalary employmentMode documentId')
      .lean(),
    Loan.countDocuments(query),
  ]);

  return { items, total };
}

export async function getLoanForActor(
  loanId: string,
  actor: { id: string; role: Role },
): Promise<unknown> {
  const loan = await Loan.findById(loanId)
    .populate('userId', 'fullName email phone')
    .populate('applicationId', 'fullName panMasked dateOfBirth monthlySalary employmentMode documentId bre')
    .lean();

  if (!loan) throw ApiError.notFound('Loan not found');

  if (actor.role === Role.BORROWER) {
    const ownerId =
      typeof loan.userId === 'object' && loan.userId !== null && '_id' in loan.userId
        ? String((loan.userId as { _id: unknown })._id)
        : String(loan.userId);
    if (ownerId !== actor.id) throw ApiError.forbidden('You cannot view this loan');
  }

  return loan;
}

export async function listMyLoans(userId: string) {
  return Loan.find({ userId }).sort({ createdAt: -1 }).lean();
}

/**
 * Loads a loan and asserts the requested transition is legal for both the
 * current status and the acting role. Every stage module goes through this.
 */
export async function loadForTransition(
  loanId: string,
  to: LoanStatus,
  actor: { id: string; role: Role },
) {
  const loan = await Loan.findById(loanId);
  if (!loan) throw ApiError.notFound('Loan not found');

  if (!canTransition(loan.status, to)) {
    throw ApiError.conflict(`A loan in status ${loan.status} cannot move to ${to}`);
  }
  if (!roleCanTransition(actor.role, loan.status, to)) {
    throw ApiError.forbidden(`Your role cannot move a loan from ${loan.status} to ${to}`);
  }

  return loan;
}

export const loanService = {
  applyForLoan,
  listLoans,
  listMyLoans,
  getLoanForActor,
  loadForTransition,
};
