'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { StatusTag } from '@/components/ui/Status';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Loan } from '@/lib/types';

const STATUS_NOTE: Record<Loan['status'], string> = {
  APPLIED: 'Under review by our sanction team.',
  SANCTIONED: 'Approved. Funds are being released.',
  DISBURSED: 'Funds released. Repay by the end of your tenure.',
  CLOSED: 'Fully repaid. Nothing is outstanding.',
  REJECTED: 'This application was not approved.',
};

export default function MyLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api
      .get<{ loans: Loan[] }>('/loans/me')
      .then((data) => setLoans(data.loans))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl">Your loans</h1>

        <div className="mt-8 space-y-6">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : loans.length === 0 ? (
            <EmptyState
              title="You have not applied for a loan yet."
              hint="Start an application to see it here."
            />
          ) : (
            loans.map((loan) => (
              <article key={loan._id} className="border border-line">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <p className="font-mono text-sm">{loan.loanRef}</p>
                    <p className="mt-0.5 text-xs text-muted">Applied {formatDate(loan.appliedAt)}</p>
                  </div>
                  <StatusTag value={loan.status} />
                </header>

                <div className="px-5 py-4">
                  <p className="text-sm text-muted">{STATUS_NOTE[loan.status]}</p>

                  {loan.status === 'REJECTED' && loan.rejectionReason ? (
                    <div className="mt-4">
                      <Alert tone="error" title="Reason given">
                        {loan.rejectionReason}
                      </Alert>
                    </div>
                  ) : null}

                  <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted">Principal</dt>
                      <dd className="mt-0.5 tabular-nums">{formatCurrency(loan.principal, true)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Tenure</dt>
                      <dd className="mt-0.5 tabular-nums">{loan.tenureDays} days</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Interest</dt>
                      <dd className="mt-0.5 tabular-nums">{formatCurrency(loan.simpleInterest)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Total repayment</dt>
                      <dd className="mt-0.5 tabular-nums">{formatCurrency(loan.totalRepayment)}</dd>
                    </div>
                  </dl>

                  {['DISBURSED', 'CLOSED'].includes(loan.status) ? (
                    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Paid so far</dt>
                        <dd className="mt-0.5 tabular-nums">{formatCurrency(loan.amountPaid)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Outstanding</dt>
                        <dd className="mt-0.5 tabular-nums">{formatCurrency(loan.outstanding)}</dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              </article>
            ))
          )}

          <Link href="/apply" className="inline-block text-sm underline">
            Back to application
          </Link>
        </div>
      </main>
    </div>
  );
}
