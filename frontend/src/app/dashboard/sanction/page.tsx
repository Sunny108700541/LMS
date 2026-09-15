'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { LoanQueue } from '@/components/dashboard/LoanQueue';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Field, TextInput } from '@/components/ui/Field';
import { Stat } from '@/components/ui/Stat';
import { api, ApiRequestError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Loan } from '@/lib/types';

export default function SanctionPage() {
  const [stats, setStats] = useState<{ pending: number; sanctioned: number; rejected: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rejecting, setRejecting] = useState<Loan | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadStats() {
    void api
      .get<{ pending: number; sanctioned: number; rejected: number }>('/sanction/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }

  useEffect(loadStats, [refreshKey]);

  async function approve(loan: Loan) {
    setError(null);
    setBusyId(loan._id);
    try {
      await api.patch(`/sanction/loans/${loan._id}/approve`, {});
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not approve the loan.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    setError(null);
    setBusyId(rejecting._id);
    try {
      await api.patch(`/sanction/loans/${rejecting._id}/reject`, { reason });
      setRejecting(null);
      setReason('');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not reject the loan.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sanction"
        description="Review each applied loan against the salary slip, then approve or reject with a reason."
      />

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Awaiting review" value={stats.pending} />
          <Stat label="Approved to date" value={stats.sanctioned} />
          <Stat label="Rejected to date" value={stats.rejected} />
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <LoanQueue
        endpoint="/sanction/queue"
        emptyTitle="Nothing is waiting for review."
        emptyHint="New applications appear here as soon as borrowers submit them."
        refreshKey={refreshKey}
        renderActions={(loan) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              loading={busyId === loan._id}
              onClick={() => void approve(loan)}
            >
              Approve
            </Button>
            <Button variant="danger" onClick={() => setRejecting(loan)}>
              Reject
            </Button>
          </div>
        )}
      />

      <Modal
        open={Boolean(rejecting)}
        title="Reject this loan"
        onClose={() => {
          setRejecting(null);
          setReason('');
        }}
      >
        <div className="space-y-5">
          <p className="text-sm text-muted">
            {rejecting ? (
              <>
                {rejecting.loanRef} · {formatCurrency(rejecting.principal, true)} for{' '}
                {rejecting.tenureDays} days
              </>
            ) : null}
          </p>

          <Field
            label="Reason"
            htmlFor="reason"
            hint="The borrower sees this, so be specific. At least 10 characters."
          >
            <TextInput
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Salary slip does not match declared income"
            />
          </Field>

          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={busyId === rejecting?._id}
              disabled={reason.trim().length < 10}
              onClick={() => void confirmReject()}
            >
              Reject loan
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setRejecting(null);
                setReason('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
