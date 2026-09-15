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

/* ─── Analytics ──────────────────────────────────────────────────────────────── */

export interface MonthlyPoint {
  /** e.g. "2025-03" */
  month: string;
  count: number;
}

export interface MonthlyAmountPoint {
  month: string;
  sanctioned: number;
  disbursed: number;
  sanctionedCount: number;
  disbursedCount: number;
}

export interface LoanStatusPoint {
  status: string;
  count: number;
}

export interface AnalyticsData {
  /** Borrower registrations per calendar month — last 12 months */
  registrationsOverTime: MonthlyPoint[];
  /** Sanctioned + disbursed principal per month — last 12 months */
  monthlyLoanActivity: MonthlyAmountPoint[];
  /** Count of loans per status (all-time) */
  loanStatusBreakdown: LoanStatusPoint[];
  /** Lead stage funnel counts */
  leadStages: { stage: LeadStage | 'CONVERTED'; count: number }[];
  /** Portfolio totals */
  portfolio: {
    totalPrincipalSanctioned: number;
    totalAmountCollected: number;
    totalOutstanding: number;
    conversionRate: number; // 0-100 %
  };
}

export async function analyticsData(): Promise<AnalyticsData> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [
    registrationsRaw,
    monthlyActivityRaw,
    loanStatusRaw,
    totalBorrowers,
    converted,
    portfolioAgg,
    leadStageAgg,
    breRejected,
    inProgress,
  ] = await Promise.all([
    // Monthly borrower registrations
    User.aggregate<{ _id: string; count: number }>([
      { $match: { role: Role.BORROWER, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Monthly sanctioned / disbursed principal amounts
    Loan.aggregate<{
      _id: string;
      sanctioned: number;
      disbursed: number;
      sanctionedCount: number;
      disbursedCount: number;
    }>([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          sanctioned: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [LoanStatus.SANCTIONED, LoanStatus.DISBURSED, LoanStatus.CLOSED],
                  ],
                },
                '$principal',
                0,
              ],
            },
          },
          disbursed: {
            $sum: {
              $cond: [
                { $in: ['$status', [LoanStatus.DISBURSED, LoanStatus.CLOSED]] },
                '$principal',
                0,
              ],
            },
          },
          sanctionedCount: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [LoanStatus.SANCTIONED, LoanStatus.DISBURSED, LoanStatus.CLOSED],
                  ],
                },
                1,
                0,
              ],
            },
          },
          disbursedCount: {
            $sum: {
              $cond: [
                { $in: ['$status', [LoanStatus.DISBURSED, LoanStatus.CLOSED]] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // All-time loan status breakdown
    Loan.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    User.countDocuments({ role: Role.BORROWER }),
    Loan.countDocuments({}),

    // Portfolio totals (sanctioned + beyond)
    Loan.aggregate<{
      totalPrincipalSanctioned: number;
      totalAmountCollected: number;
      totalOutstanding: number;
    }>([
      {
        $match: {
          status: { $in: [LoanStatus.SANCTIONED, LoanStatus.DISBURSED, LoanStatus.CLOSED] },
        },
      },
      {
        $group: {
          _id: null,
          totalPrincipalSanctioned: { $sum: '$principal' },
          totalAmountCollected: { $sum: '$amountPaid' },
          totalOutstanding: { $sum: '$outstanding' },
        },
      },
    ]),

    Application.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          status: { $in: [ApplicationStatus.DRAFT, ApplicationStatus.DOCUMENT_UPLOADED] },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    Application.countDocuments({ status: ApplicationStatus.BRE_REJECTED }),
    Application.countDocuments({
      status: { $in: [ApplicationStatus.DRAFT, ApplicationStatus.DOCUMENT_UPLOADED] },
    }),
  ]);

  // Build a 12-month skeleton so months with no data still appear as 0
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const regMap = new Map(registrationsRaw.map((r) => [r._id, r.count]));
  const actMap = new Map(monthlyActivityRaw.map((r) => [r._id, r]));

  const registrationsOverTime: MonthlyPoint[] = monthKeys.map((m) => ({
    month: m,
    count: regMap.get(m) ?? 0,
  }));

  const monthlyLoanActivity: MonthlyAmountPoint[] = monthKeys.map((m) => ({
    month: m,
    sanctioned: actMap.get(m)?.sanctioned ?? 0,
    disbursed: actMap.get(m)?.disbursed ?? 0,
    sanctionedCount: actMap.get(m)?.sanctionedCount ?? 0,
    disbursedCount: actMap.get(m)?.disbursedCount ?? 0,
  }));

  const loanStatusBreakdown: LoanStatusPoint[] = loanStatusRaw.map((r) => ({
    status: r._id,
    count: r.count,
  }));

  // Build lead funnel stages
  const stageMap: Record<string, number> = {};
  for (const s of leadStageAgg) stageMap[s._id] = s.count;

  const registeredOnly = Math.max(0, totalBorrowers - converted - inProgress - breRejected);
  const leadStages = [
    { stage: 'REGISTERED' as const, count: registeredOnly },
    { stage: 'DETAILS_SUBMITTED' as const, count: stageMap[ApplicationStatus.DRAFT] ?? 0 },
    { stage: 'DOCUMENT_UPLOADED' as const, count: stageMap[ApplicationStatus.DOCUMENT_UPLOADED] ?? 0 },
    { stage: 'BRE_REJECTED' as const, count: breRejected },
    { stage: 'CONVERTED' as const, count: converted },
  ];

  const port = portfolioAgg[0] ?? {
    totalPrincipalSanctioned: 0,
    totalAmountCollected: 0,
    totalOutstanding: 0,
  };
  const conversionRate =
    totalBorrowers > 0 ? Math.round((converted / totalBorrowers) * 100) : 0;

  return {
    registrationsOverTime,
    monthlyLoanActivity,
    loanStatusBreakdown,
    leadStages,
    portfolio: {
      totalPrincipalSanctioned: port.totalPrincipalSanctioned,
      totalAmountCollected: port.totalAmountCollected,
      totalOutstanding: port.totalOutstanding,
      conversionRate,
    },
  };
}

/* ─── Loan Borrowers ─────────────────────────────────────────────────────────── */

export interface BorrowerLoan {
  loanId: string;
  loanRef: string;
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  amountPaid: number;
  outstanding: number;
  status: string;
  sanctionedAt: Date | null;
  disbursedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
}

export async function loanBorrowers(
  pagination: Pagination,
): Promise<{ items: BorrowerLoan[]; total: number }> {
  const skip = (pagination.page - 1) * pagination.limit;

  const [loans, total] = await Promise.all([
    Loan.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate<{ userId: { _id: unknown; fullName: string; email: string } }>(
        'userId',
        'fullName email',
      )
      .lean(),
    Loan.countDocuments({}),
  ]);

  const items: BorrowerLoan[] = loans.map((loan) => {
    const user =
      typeof loan.userId === 'object' && loan.userId !== null
        ? (loan.userId as { _id: unknown; fullName: string; email: string })
        : null;
    return {
      loanId: loan._id.toString(),
      loanRef: loan.loanRef,
      borrowerName: user?.fullName ?? 'Unknown',
      borrowerEmail: user?.email ?? '—',
      principal: loan.principal,
      amountPaid: loan.amountPaid,
      outstanding: loan.outstanding,
      status: loan.status,
      sanctionedAt: loan.sanctionedAt,
      disbursedAt: loan.disbursedAt,
      closedAt: loan.closedAt,
      createdAt: loan.createdAt,
    };
  });

  return { items, total };
}

export const salesService = { listLeads, leadStats, analyticsData, loanBorrowers };
