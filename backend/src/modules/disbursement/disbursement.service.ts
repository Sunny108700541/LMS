import type { Request } from 'express';
import { Types } from 'mongoose';
import { Loan, type ILoan } from '../../models/Loan.model';
import { loanService } from '../loans/loan.service';
import { auditService } from '../audit/audit.service';
import { AuditAction, LoanStatus, type Role } from '../../types/enums';
import type { Pagination } from '../../utils/pagination';

/** Disbursement works the SANCTIONED queue: funds released → DISBURSED. */
export async function queue(pagination: Pagination) {
  return loanService.listLoans({
    status: LoanStatus.SANCTIONED,
    ...(pagination.search ? { search: pagination.search } : {}),
    page: pagination.page,
    limit: pagination.limit,
  });
}

export async function disburse(
  loanId: string,
  actor: { id: string; role: Role },
  payload: { transferReference?: string; note?: string },
  req: Request,
): Promise<ILoan> {
  const loan = await loanService.loadForTransition(loanId, LoanStatus.DISBURSED, actor);

  loan.status = LoanStatus.DISBURSED;
  loan.disbursedBy = new Types.ObjectId(actor.id);
  loan.disbursedAt = new Date();
  await loan.save();

  await auditService.record({
    action: AuditAction.LOAN_DISBURSED,
    entityType: 'Loan',
    entityId: loanId,
    metadata: {
      transferReference: payload.transferReference ?? null,
      note: payload.note ?? null,
      amount: loan.principal,
    },
    req,
  });

  return loan.toObject() as ILoan;
}

export async function stats() {
  const [pending, disbursed, disbursedValue] = await Promise.all([
    Loan.countDocuments({ status: LoanStatus.SANCTIONED }),
    Loan.countDocuments({ status: { $in: [LoanStatus.DISBURSED, LoanStatus.CLOSED] } }),
    Loan.aggregate<{ total: number }>([
      { $match: { status: { $in: [LoanStatus.DISBURSED, LoanStatus.CLOSED] } } },
      { $group: { _id: null, total: { $sum: '$principal' } } },
      { $project: { _id: 0, total: 1 } },
    ]),
  ]);

  return { pending, disbursed, disbursedValue: disbursedValue[0]?.total ?? 0 };
}

export const disbursementService = { queue, disburse, stats };
