import { User } from '../../models/User.model';
import { Application } from '../../models/Application.model';
import { Loan } from '../../models/Loan.model';
import { ApplicationStatus, LoanStatus, Role } from '../../types/enums';
import type { Pagination } from '../../utils/pagination';

/**
 * Sales owns the pre-application funnel: people who registered but have not
 * raised a loan yet. A lead is one of:
 *   - registered only (no application)
 *   - details captured, nothing uploaded
 *   - slip uploaded, loan not submitted
 *   - rejected by the BRE (worth a follow-up call)
 */
export type LeadStage =
  | 'REGISTERED'
  | 'DETAILS_SUBMITTED'
  | 'DOCUMENT_UPLOADED'
  | 'BRE_REJECTED';

export interface Lead {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  registeredAt: Date;
  stage: LeadStage;
  applicationId: string | null;
  panMasked: string | null;
  monthlySalary: number | null;
  employmentMode: string | null;
  breFailures: string[];
  lastActivityAt: Date;
}

export async function listLeads(pagination: Pagination): Promise<{ items: Lead[]; total: number }> {
  const borrowerFilter: Record<string, unknown> = { role: Role.BORROWER };
  if (pagination.search) {
    // Escaped so a lead search cannot inject a regex denial-of-service pattern.
    const escaped = pagination.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    borrowerFilter.$or = [
      { fullName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  // Borrowers with any loan are past the sales stage.
  const convertedUserIds = await Loan.distinct('userId');
  borrowerFilter._id = { $nin: convertedUserIds };

  const skip = (pagination.page - 1) * pagination.limit;
  const [users, total] = await Promise.all([
    User.find(borrowerFilter).sort({ createdAt: -1 }).skip(skip).limit(pagination.limit).lean(),
    User.countDocuments(borrowerFilter),
  ]);

  const applications = await Application.find({ userId: { $in: users.map((u) => u._id) } })
    .sort({ createdAt: -1 })
    .lean();

  const latestByUser = new Map<string, (typeof applications)[number]>();
  for (const app of applications) {
    const key = app.userId.toString();
    if (!latestByUser.has(key)) latestByUser.set(key, app);
  }

  const items: Lead[] = users.map((user) => {
    const app = latestByUser.get(user._id.toString());
    let stage: LeadStage = 'REGISTERED';
    if (app?.status === ApplicationStatus.BRE_REJECTED) stage = 'BRE_REJECTED';
    else if (app?.status === ApplicationStatus.DOCUMENT_UPLOADED) stage = 'DOCUMENT_UPLOADED';
    else if (app?.status === ApplicationStatus.DRAFT) stage = 'DETAILS_SUBMITTED';

    return {
      userId: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? null,
      registeredAt: user.createdAt,
      stage,
      applicationId: app ? app._id.toString() : null,
      panMasked: app?.panMasked ?? null,
      monthlySalary: app?.monthlySalary ?? null,
      employmentMode: app?.employmentMode ?? null,
      breFailures: app?.bre?.failures?.map((f) => f.rule) ?? [],
      lastActivityAt: app?.updatedAt ?? user.createdAt,
    };
  });

  return { items, total };
}

export async function leadStats() {
  const convertedUserIds = await Loan.distinct('userId');
  const [totalBorrowers, withApplication, breRejected, converted] = await Promise.all([
    User.countDocuments({ role: Role.BORROWER }),
    Application.countDocuments({
      status: { $in: [ApplicationStatus.DRAFT, ApplicationStatus.DOCUMENT_UPLOADED] },
    }),
    Application.countDocuments({ status: ApplicationStatus.BRE_REJECTED }),
    Loan.countDocuments({}),
  ]);

  return {
    totalBorrowers,
    openLeads: totalBorrowers - convertedUserIds.length,
    inProgress: withApplication,
    breRejected,
    converted,
  };
}

export const salesService = { listLeads, leadStats };
