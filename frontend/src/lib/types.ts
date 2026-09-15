export type Role = 'ADMIN' | 'SALES' | 'SANCTION' | 'DISBURSEMENT' | 'COLLECTION' | 'BORROWER';

export type EmploymentMode = 'SALARIED' | 'SELF_EMPLOYED' | 'UNEMPLOYED';

export type ApplicationStatus = 'DRAFT' | 'DOCUMENT_UPLOADED' | 'SUBMITTED' | 'BRE_REJECTED';

export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BreFailure {
  rule: string;
  message: string;
}

export interface Application {
  id: string;
  fullName: string;
  panMasked: string;
  dateOfBirth: string;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  status: ApplicationStatus;
  bre: { passed: boolean; failures: BreFailure[]; evaluatedAt: string };
  hasDocument: boolean;
  documentId: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface PopulatedUser {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
}

export interface PopulatedApplication {
  _id: string;
  fullName: string;
  panMasked: string;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  documentId: string | null;
}

export interface Loan {
  _id: string;
  loanRef: string;
  userId: PopulatedUser | string;
  applicationId: PopulatedApplication | string;
  principal: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  amountPaid: number;
  outstanding: number;
  status: LoanStatus;
  appliedAt: string;
  sanctionedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  disbursedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface Payment {
  _id: string;
  loanId: string;
  utrNumber: string;
  amount: number;
  paidAt: string;
  note: string | null;
  outstandingAfter: number;
  recordedBy: { _id: string; fullName: string; role: Role } | string;
  createdAt: string;
}

export type LeadStage = 'REGISTERED' | 'DETAILS_SUBMITTED' | 'DOCUMENT_UPLOADED' | 'BRE_REJECTED';

export interface Lead {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  stage: LeadStage;
  applicationId: string | null;
  panMasked: string | null;
  monthlySalary: number | null;
  employmentMode: EmploymentMode | null;
  breFailures: string[];
  lastActivityAt: string;
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorRole: string | null;
  actorId: { _id: string; fullName: string; email: string } | string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MonthlyPoint {
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
  registrationsOverTime: MonthlyPoint[];
  monthlyLoanActivity: MonthlyAmountPoint[];
  loanStatusBreakdown: LoanStatusPoint[];
  leadStages: { stage: LeadStage | 'CONVERTED'; count: number }[];
  portfolio: {
    totalPrincipalSanctioned: number;
    totalAmountCollected: number;
    totalOutstanding: number;
    conversionRate: number;
  };
}

export interface BorrowerLoan {
  loanId: string;
  loanRef: string;
  borrowerName: string;
  borrowerEmail: string;
  principal: number;
  amountPaid: number;
  outstanding: number;
  status: string;
  sanctionedAt: string | null;
  disbursedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}
