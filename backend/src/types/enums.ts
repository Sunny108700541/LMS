export const Role = {
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  SANCTION: 'SANCTION',
  DISBURSEMENT: 'DISBURSEMENT',
  COLLECTION: 'COLLECTION',
  BORROWER: 'BORROWER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const EXECUTIVE_ROLES: Role[] = [
  Role.SALES,
  Role.SANCTION,
  Role.DISBURSEMENT,
  Role.COLLECTION,
];

export const EmploymentMode = {
  SALARIED: 'SALARIED',
  SELF_EMPLOYED: 'SELF_EMPLOYED',
  UNEMPLOYED: 'UNEMPLOYED',
} as const;
export type EmploymentMode = (typeof EmploymentMode)[keyof typeof EmploymentMode];

/** Lifecycle of the KYC/application record that precedes a loan. */
export const ApplicationStatus = {
  DRAFT: 'DRAFT', // created, personal details captured
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED', // salary slip attached
  SUBMITTED: 'SUBMITTED', // loan raised from it
  BRE_REJECTED: 'BRE_REJECTED', // failed the business rule engine
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

/** Lifecycle of the loan itself. */
export const LoanStatus = {
  APPLIED: 'APPLIED',
  SANCTIONED: 'SANCTIONED',
  REJECTED: 'REJECTED',
  DISBURSED: 'DISBURSED',
  CLOSED: 'CLOSED',
} as const;
export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const AuditAction = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
  ADMIN_BOOTSTRAPPED: 'ADMIN_BOOTSTRAPPED',
  USER_CREATED: 'USER_CREATED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  APPLICATION_BRE_REJECTED: 'APPLICATION_BRE_REJECTED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_VIEWED: 'DOCUMENT_VIEWED',
  LOAN_APPLIED: 'LOAN_APPLIED',
  LOAN_SANCTIONED: 'LOAN_SANCTIONED',
  LOAN_REJECTED: 'LOAN_REJECTED',
  LOAN_DISBURSED: 'LOAN_DISBURSED',
  PAYMENT_RECORDED: 'PAYMENT_RECORDED',
  LOAN_CLOSED: 'LOAN_CLOSED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
