'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { StepIndicator } from '@/components/apply/StepIndicator';
import { PersonalDetailsStep } from '@/components/apply/PersonalDetailsStep';
import { UploadStep } from '@/components/apply/UploadStep';
import { LoanConfigStep } from '@/components/apply/LoanConfigStep';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthProvider';
import type { Application, Loan } from '@/lib/types';

export default function ApplyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [application, setApplication] = useState<Application | null>(null);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [breBlocked, setBreBlocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appData, loanData] = await Promise.all([
        api.get<{ application: Application | null }>('/applications/me'),
        api.get<{ loans: Loan[] }>('/loans/me'),
      ]);
      setApplication(appData.application);
      const open = loanData.loans.find((loan) =>
        ['APPLIED', 'SANCTIONED', 'DISBURSED'].includes(loan.status),
      );
      setActiveLoan(open ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && user.role !== 'BORROWER') {
      router.replace('/dashboard');
      return;
    }
    if (user?.role === 'BORROWER') void load();
  }, [user, authLoading, router, load]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <p className="text-sm text-muted">Loading your application…</p>
        </main>
      </div>
    );
  }

  // Someone with a loan in flight has nothing to fill in — send them to its status.
  if (activeLoan) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl space-y-6 px-4 py-16 sm:px-6">
          <h1 className="text-2xl">Your application is with us</h1>
          <Alert tone="info" title={`Loan ${activeLoan.loanRef}`}>
            You can follow its progress on your loans page.
          </Alert>
          <Link
            href="/loans"
            className="inline-block border border-black bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
          >
            View my loan
          </Link>
        </main>
      </div>
    );
  }

  const step = !application ? 1 : application.hasDocument ? 3 : 2;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl">Apply for a loan</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Three steps. You will see the exact repayment amount before anything is submitted.
        </p>

        <div className="mt-8">
          <StepIndicator current={step} />
        </div>

        <div className="mt-8">
          {breBlocked ? (
            <div className="space-y-4">
              <Alert tone="error" title="You are not eligible right now">
                Correct the details below and try again.
              </Alert>
              <button
                type="button"
                onClick={() => {
                  setBreBlocked(false);
                  void load();
                }}
                className="border border-black px-4 py-2 text-sm hover:bg-subtle"
              >
                Start over
              </button>
            </div>
          ) : step === 1 ? (
            <PersonalDetailsStep onCompleted={(app) => setApplication(app)} />
          ) : step === 2 && application ? (
            <UploadStep
              applicationId={application.id}
              alreadyUploaded={application.hasDocument}
              onCompleted={() => void load()}
            />
          ) : (
            <LoanConfigStep
              onApplied={() => {
                router.push('/loans');
                router.refresh();
              }}
            />
          )}
        </div>

        {application ? (
          <dl className="mt-12 divide-y divide-line border-t border-line text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-muted">Applicant</dt>
              <dd>{application.fullName}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-muted">PAN</dt>
              <dd className="font-mono">{application.panMasked}</dd>
            </div>
          </dl>
        ) : null}
      </main>
    </div>
  );
}
