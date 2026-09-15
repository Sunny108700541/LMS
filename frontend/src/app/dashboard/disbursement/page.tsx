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

interface DisbursementStats {
  pending: number;
  disbursed: number;
  disbursedValue: number;
}

export default function DisbursementPage() {
  const [stats, setStats] = useState<DisbursementStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [target, setTarget] = useState<Loan | null>(null);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .get<DisbursementStats>('/disbursement/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }, [refreshKey]);

  async function confirmDisburse() {
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/disbursement/loans/${target._id}/disburse`, {
        ...(reference.trim() ? { transferReference: reference.trim() } : {}),
      });
      setTarget(null);
      setReference('');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not mark the loan disbursed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disbursement"
        description="Sanctioned loans waiting for funds to be released. Mark each one once the transfer is done."
      />

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Awaiting release" value={stats.pending} />
          <Stat label="Disbursed to date" value={stats.disbursed} />
          <Stat label="Value disbursed" value={formatCurrency(stats.disbursedValue, true)} />
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <LoanQueue
        endpoint="/disbursement/queue"
        emptyTitle="No sanctioned loans are waiting."
        emptyHint="Loans appear here once the sanction team approves them."
        refreshKey={refreshKey}
        renderActions={(loan) => (
          <Button variant="secondary" onClick={() => setTarget(loan)}>
            Mark disbursed
          </Button>
        )}
      />

      <Modal
        open={Boolean(target)}
        title="Confirm disbursement"
        onClose={() => {
          setTarget(null);
          setReference('');
        }}
      >
        <div className="space-y-5">
          {target ? (
            <dl className="divide-y divide-line border-y border-line text-sm">
              <div className="flex justify-between py-3">
                <dt className="text-muted">Loan</dt>
                <dd className="font-mono">{target.loanRef}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-muted">Amount to release</dt>
                <dd className="tabular-nums">{formatCurrency(target.principal)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-muted">Repayable</dt>
                <dd className="tabular-nums">{formatCurrency(target.totalRepayment)}</dd>
              </div>
            </dl>
          ) : null}

          <Field
            label="Transfer reference"
            htmlFor="reference"
            hint="Optional. Recorded in the activity log for reconciliation."
          >
            <TextInput
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>

          <div className="flex gap-2">
            <Button loading={busy} onClick={() => void confirmDisburse()}>
              Confirm disbursement
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setTarget(null);
                setReference('');
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
