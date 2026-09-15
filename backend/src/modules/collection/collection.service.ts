import type { Request } from 'express';
import { Types } from 'mongoose';
import { Loan, type ILoan } from '../../models/Loan.model';
import { Payment } from '../../models/Payment.model';
import { ApiError } from '../../utils/ApiError';
import { AuditAction, LoanStatus, type Role } from '../../types/enums';
import { roundMoney, SETTLEMENT_EPSILON } from '../../rules/loan.rules';
import { auditService } from '../audit/audit.service';
import { loanService } from '../loans/loan.service';
import type { Pagination } from '../../utils/pagination';
import type { RecordPaymentInput } from './collection.validation';

/** Collection works the DISBURSED book: record repayments until the balance clears. */
export async function queue(pagination: Pagination) {
  return loanService.listLoans({
    status: LoanStatus.DISBURSED,
    ...(pagination.search ? { search: pagination.search } : {}),
    page: pagination.page,
    limit: pagination.limit,
  });
}

export async function listPayments(loanId: string) {
  return Payment.find({ loanId })
    .sort({ paidAt: -1, createdAt: -1 })
    .populate('recordedBy', 'fullName email role')
    .lean();
}

/**
 * Record a repayment.
 *
 * Outstanding balance is not recomputed from the payment history on read — it
 * is decremented atomically on the loan document, with the match condition
 * `outstanding >= amount`. Two executives submitting at the same moment cannot
 * both succeed past the balance, so the loan can never be overpaid.
 *
 * MongoDB may be running standalone (no transactions), so the payment insert
 * that follows is compensated by reversing the increment if it fails.
 */
export async function recordPayment(
  loanId: string,
  input: RecordPaymentInput,
  actor: { id: string; role: Role },
  req: Request,
): Promise<{ payment: unknown; loan: ILoan; closed: boolean }> {
  const loan = await Loan.findById(loanId);
  if (!loan) throw ApiError.notFound('Loan not found');

  if (loan.status === LoanStatus.CLOSED) throw ApiError.conflict('This loan is already closed');
  if (loan.status !== LoanStatus.DISBURSED) {
    throw ApiError.conflict('Payments can only be recorded against a disbursed loan');
  }
  if (input.paidAt < (loan.disbursedAt ?? loan.createdAt)) {
    throw ApiError.badRequest('Payment date cannot be before the loan was disbursed');
  }

  const amount = roundMoney(input.amount);
  if (amount > roundMoney(loan.outstanding) + SETTLEMENT_EPSILON) {
    throw ApiError.badRequest(
      `Payment exceeds the outstanding balance of ₹${roundMoney(loan.outstanding).toLocaleString('en-IN')}`,
    );
  }

  // Fail fast on a duplicate UTR so we do not touch the balance unnecessarily.
  const duplicate = await Payment.findOne({ utrNumber: input.utrNumber }).select('_id');
  if (duplicate) throw ApiError.conflict('This UTR number has already been recorded');

  const updated = await Loan.findOneAndUpdate(
    {
      _id: new Types.ObjectId(loanId),
      status: LoanStatus.DISBURSED,
      outstanding: { $gte: amount - SETTLEMENT_EPSILON },
    },
    { $inc: { amountPaid: amount, outstanding: -amount } },
    { new: true },
  );

  if (!updated) {
    throw ApiError.conflict('The loan balance changed. Reload the loan and try again.');
  }

  let payment;
  try {
    payment = await Payment.create({
      loanId: updated._id,
      userId: updated.userId,
      utrNumber: input.utrNumber,
      amount,
      paidAt: input.paidAt,
      note: input.note ?? null,
      recordedBy: actor.id,
      outstandingAfter: roundMoney(Math.max(0, updated.outstanding)),
    });
  } catch (err) {
    // Compensate: the balance must never move without a matching payment row.
    await Loan.updateOne({ _id: updated._id }, { $inc: { amountPaid: -amount, outstanding: amount } });
    throw err;
  }

  // Auto-close once the full repayment has been collected.
  let closed = false;
  if (roundMoney(updated.outstanding) <= SETTLEMENT_EPSILON) {
    const closedLoan = await Loan.findOneAndUpdate(
      { _id: updated._id, status: LoanStatus.DISBURSED },
      { $set: { status: LoanStatus.CLOSED, closedAt: new Date(), outstanding: 0 } },
      { new: true },
    );
    closed = Boolean(closedLoan);
    if (closedLoan) {
      await auditService.record({
        action: AuditAction.LOAN_CLOSED,
        entityType: 'Loan',
        entityId: loanId,
        metadata: { totalPaid: closedLoan.amountPaid },
        req,
      });
    }
  }

  await auditService.record({
    action: AuditAction.PAYMENT_RECORDED,
    entityType: 'Payment',
    entityId: payment._id.toString(),
    metadata: { loanId, amount, utrNumber: input.utrNumber },
    req,
  });

  const finalLoan = await Loan.findById(loanId).lean();
  return { payment: payment.toObject(), loan: finalLoan as ILoan, closed };
}

export async function stats() {
  const [active, closed, collected] = await Promise.all([
    Loan.countDocuments({ status: LoanStatus.DISBURSED }),
    Loan.countDocuments({ status: LoanStatus.CLOSED }),
    Payment.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$amount' } } },
      { $project: { _id: 0, total: 1 } },
    ]),
  ]);

  const outstanding = await Loan.aggregate<{ total: number }>([
    { $match: { status: LoanStatus.DISBURSED } },
    { $group: { _id: null, total: { $sum: '$outstanding' } } },
    { $project: { _id: 0, total: 1 } },
  ]);

  return {
    activeLoans: active,
    closedLoans: closed,
    totalCollected: roundMoney(collected[0]?.total ?? 0),
    totalOutstanding: roundMoney(outstanding[0]?.total ?? 0),
  };
}

export const collectionService = { queue, listPayments, recordPayment, stats };
