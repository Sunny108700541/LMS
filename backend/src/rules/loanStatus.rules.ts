import { LoanStatus, Role } from '../types/enums';


export const LOAN_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  [LoanStatus.APPLIED]: [LoanStatus.SANCTIONED, LoanStatus.REJECTED],
  [LoanStatus.SANCTIONED]: [LoanStatus.DISBURSED],
  [LoanStatus.DISBURSED]: [LoanStatus.CLOSED],
  [LoanStatus.REJECTED]: [],
  [LoanStatus.CLOSED]: [],
};

/** Which role owns each transition. ADMIN is allowed everywhere. */
export const TRANSITION_OWNERS: Record<string, Role[]> = {
  [`${LoanStatus.APPLIED}->${LoanStatus.SANCTIONED}`]: [Role.SANCTION, Role.ADMIN],
  [`${LoanStatus.APPLIED}->${LoanStatus.REJECTED}`]: [Role.SANCTION, Role.ADMIN],
  [`${LoanStatus.SANCTIONED}->${LoanStatus.DISBURSED}`]: [Role.DISBURSEMENT, Role.ADMIN],
  [`${LoanStatus.DISBURSED}->${LoanStatus.CLOSED}`]: [Role.COLLECTION, Role.ADMIN],
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return (LOAN_TRANSITIONS[from] ?? []).includes(to);
}

export function roleCanTransition(role: Role, from: LoanStatus, to: LoanStatus): boolean {
  return (TRANSITION_OWNERS[`${from}->${to}`] ?? []).includes(role);
}
