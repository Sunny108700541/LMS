import type { Request } from 'express';
import { User, type IUser } from '../../models/User.model';
import { Loan } from '../../models/Loan.model';
import { Payment } from '../../models/Payment.model';
import { AuditLog } from '../../models/AuditLog.model';
import { Application } from '../../models/Application.model';
import { ApiError } from '../../utils/ApiError';
import { AuditAction, LoanStatus, Role } from '../../types/enums';
import { auditService } from '../audit/audit.service';
import { toPublicUser } from '../auth/auth.service';
import type { Pagination } from '../../utils/pagination';

export async function listUsers(pagination: Pagination, role?: Role) {
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (pagination.search) {
    const escaped = pagination.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pagination.limit),
    User.countDocuments(filter),
  ]);

  return { items: users.map((u) => toPublicUser(u.toObject() as IUser)), total };
}

/** Deactivating bumps tokenVersion, so existing sessions stop working at once. */
export async function setUserActive(
  userId: string,
  isActive: boolean,
  actorId: string,
  req: Request,
) {
  if (userId === actorId) throw ApiError.badRequest('You cannot change your own account status');

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === Role.ADMIN) throw ApiError.forbidden('The admin account cannot be deactivated');

  user.isActive = isActive;
  user.tokenVersion += 1;
  user.refreshTokenHash = null;
  await user.save();

  await auditService.record({
    action: AuditAction.USER_STATUS_CHANGED,
    entityType: 'User',
    entityId: userId,
    metadata: { isActive },
    req,
  });

  return toPublicUser(user.toObject() as IUser);
}

export async function overview() {
  const [byStatus, users, applications, payments] = await Promise.all([
    Loan.aggregate<{ _id: LoanStatus; count: number; value: number }>([
      { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$principal' } } },
    ]),
    User.aggregate<{ _id: Role; count: number }>([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Application.countDocuments({}),
    Payment.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$amount' } } },
      { $project: { _id: 0, total: 1 } },
    ]),
  ]);

  const loans = Object.fromEntries(
    byStatus.map((row) => [row._id, { count: row.count, value: row.value }]),
  );

  return {
    loans,
    totalLoans: byStatus.reduce((sum, row) => sum + row.count, 0),
    usersByRole: Object.fromEntries(users.map((row) => [row._id, row.count])),
    totalApplications: applications,
    totalCollected: payments[0]?.total ?? 0,
  };
}

export async function listAuditLogs(pagination: Pagination) {
  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    AuditLog.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate('actorId', 'fullName email role')
      .lean(),
    AuditLog.countDocuments({}),
  ]);
  return { items, total };
}

export async function listAllLoans(pagination: Pagination, status?: LoanStatus) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (pagination.search) {
    filter.loanRef = { $regex: pagination.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Loan.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate('userId', 'fullName email phone')
      .populate('applicationId', 'fullName panMasked monthlySalary employmentMode documentId')
      .lean(),
    Loan.countDocuments(filter),
  ]);
  return { items, total };
}

export const adminService = {
  listUsers,
  setUserActive,
  overview,
  listAuditLogs,
  listAllLoans,
};
