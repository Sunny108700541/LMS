import type { Request } from 'express';
import { Types } from 'mongoose';
import { Loan, type ILoan } from '../../models/Loan.model';
import { loanService } from '../loans/loan.service';
import { auditService } from '../audit/audit.service';
import { AuditAction, LoanStatus, type Role } from '../../types/enums';
import type { Pagination } from '../../utils/pagination';

/** Sanction works the APPLIED queue: approve → SANCTIONED, reject → REJECTED. */
export async function queue(pagination: Pagination) {
  return loanService.listLoans({
    status: LoanStatus.APPLIED,
    ...(pagination.search ? { search: pagination.search } : {}),
    page: pagination.page,
    limit: pagination.limit,
  });
}

export async function approve(
  loanId: string,
  actor: { id: string; role: Role },
  note: string | undefined,
  req: Request,
): Promise<ILoan> {
  const loan = await loanService.loadForTransition(loanId, LoanStatus.SANCTIONED, actor);

  loan.status = LoanStatus.SANCTIONED;
  loan.sanctionedBy = new Types.ObjectId(actor.id);
  loan.sanctionedAt = new Date();
  await loan.save();

  await auditService.record({
    action: AuditAction.LOAN_SANCTIONED,
    entityType: 'Loan',
    entityId: loanId,
    metadata: { note: note ?? null },
    req,
  });

  return loan.toObject() as ILoan;
}

export async function reject(
  loanId: string,
  actor: { id: string; role: Role },
  reason: string,
  req: Request,
): Promise<ILoan> {
  const loan = await loanService.loadForTransition(loanId, LoanStatus.REJECTED, actor);

  loan.status = LoanStatus.REJECTED;
  loan.rejectedBy = new Types.ObjectId(actor.id);
  loan.rejectedAt = new Date();
  loan.rejectionReason = reason;
  await loan.save();

  await auditService.record({
    action: AuditAction.LOAN_REJECTED,
    entityType: 'Loan',
    entityId: loanId,
    metadata: { reason },
    req,
  });

  return loan.toObject() as ILoan;
}

export async function stats() {
  const [pending, sanctioned, rejected] = await Promise.all([
    Loan.countDocuments({ status: LoanStatus.APPLIED }),
    Loan.countDocuments({ status: { $in: [LoanStatus.SANCTIONED, LoanStatus.DISBURSED, LoanStatus.CLOSED] } }),
    Loan.countDocuments({ status: LoanStatus.REJECTED }),
  ]);
  return { pending, sanctioned, rejected };
}

export const sanctionService = { queue, approve, reject, stats };
