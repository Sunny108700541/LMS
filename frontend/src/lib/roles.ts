import type { Role } from './types';

/** One module per executive role; the admin sees all of them. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/dashboard',
  SALES: '/dashboard/sales',
  SANCTION: '/dashboard/sanction',
  DISBURSEMENT: '/dashboard/disbursement',
  COLLECTION: '/dashboard/collection',
  BORROWER: '/apply',
};

export interface NavItem {
  href: string;
  label: string;
  description: string;
  roles: Role[];
}

export const DASHBOARD_NAV: NavItem[] = [
  {
    href: '/dashboard/sales',
    label: 'Sales',
    description: 'Registered users who have not applied yet',
    roles: ['SALES', 'ADMIN'],
  },
  {
    href: '/dashboard/sanction',
    label: 'Sanction',
    description: 'Review applied loans and approve or reject',
    roles: ['SANCTION', 'ADMIN'],
  },
  {
    href: '/dashboard/disbursement',
    label: 'Disbursement',
    description: 'Release funds for sanctioned loans',
    roles: ['DISBURSEMENT', 'ADMIN'],
  },
  {
    href: '/dashboard/collection',
    label: 'Collection',
    description: 'Record repayments on active loans',
    roles: ['COLLECTION', 'ADMIN'],
  },
  {
    href: '/dashboard/users',
    label: 'Users',
    description: 'Create and manage team accounts',
    roles: ['ADMIN'],
  },
  {
    href: '/dashboard/audit',
    label: 'Activity',
    description: 'Every action recorded across the system',
    roles: ['ADMIN'],
  },
];

export function canAccess(role: Role, item: NavItem): boolean {
  return item.roles.includes(role);
}
