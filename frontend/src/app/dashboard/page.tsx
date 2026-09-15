'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Stat } from '@/components/ui/Stat';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthProvider';
import { DASHBOARD_NAV, ROLE_HOME, canAccess } from '@/lib/roles';
import { formatCurrency } from '@/lib/format';

interface Overview {
  loans: Record<string, { count: number; value: number }>;
  totalLoans: number;
  usersByRole: Record<string, number>;
  totalApplications: number;
  totalCollected: number;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);

  // Executives land on their own module; only the admin sees this summary.
  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace(ROLE_HOME[user.role]);
  }, [user, router]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      void api.get<Overview>('/admin/overview').then(setOverview).catch(() => setOverview(null));
    }
  }, [user]);

  if (!user || user.role !== 'ADMIN') return null;

  const items = DASHBOARD_NAV.filter((item) => canAccess(user.role, item));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Every module and the current state of the book."
      />

      {overview ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Loans" value={overview.totalLoans} />
          <Stat label="Awaiting sanction" value={overview.loans.APPLIED?.count ?? 0} />
          <Stat label="Awaiting disbursement" value={overview.loans.SANCTIONED?.count ?? 0} />
          <Stat label="Collected" value={formatCurrency(overview.totalCollected, true)} />
        </div>
      ) : null}

      <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="group bg-white p-6 hover:bg-subtle">
            <p className="text-base group-hover:underline">{item.label}</p>
            <p className="mt-1 text-sm text-muted">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
