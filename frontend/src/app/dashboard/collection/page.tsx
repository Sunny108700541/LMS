'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { LoanQueue } from '@/components/dashboard/LoanQueue';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Field, TextInput } from '@/components/ui/Field';
import { Stat } from '@/components/ui/Stat';
import { Table, Th, Td } from '@/components/ui/Table';
import { api, ApiRequestError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Loan, Payment } from '@/lib/types';

interface CollectionStats {
  activeLoans: number;
  closedLoans: number;
  totalCollected: number;
  totalOutstanding: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function CollectionPage() {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [target, setTarget] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState({ utrNumber: '', amount: '', paidAt: today(), note: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .get<CollectionStats>('/collection/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }, [refreshKey]);

  async function openLoan(loan: Loan) {
    setTarget(loan);
    setError(null);
    setForm({ utrNumber: '', amount: String(loan.outstanding), paidAt: today(), note: '' });
    try {
      const data = await api.get<{ payments: Payment[] }>(`/collection/loans/${loan._id}/payments`);
      setPayments(data.payments);
    } catch {
      setPayments([]);
    }
  }

  function close() {
    setTarget(null);
    setPayments([]);
    setError(null);
  }

  async function submitPayment() {
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<{ closed: boolean; loan: Loan }>(
        `/collection/loans/${target._id}/payments`,
        {
          utrNumber: form.utrNumber.trim().toUpperCase(),
          amount: Number(form.amount),
          paidAt: form.paidAt,
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        },
      );
      setNotice(
        result.closed
          ? `${target.loanRef} is fully repaid and now closed.`
          : `Payment recorded. ${formatCurrency(result.loan.outstanding)} still outstanding.`,
      );
      close();
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not record the payment.');
    } finally {
      setBusy(false);
    }
  }

  const amountValue = Number(form.amount || 0);
  const amountInvalid =
    !form.amount || amountValue <= 0 || (target ? amountValue > target.outstanding + 0.005 : false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection"
        description="Active loans and their repayments. A loan closes on its own once the full repayment is collected."
      />

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active loans" value={stats.activeLoans} />
          <Stat label="Closed loans" value={stats.closedLoans} />
          <Stat label="Collected" value={formatCurrency(stats.totalCollected, true)} />
          <Stat label="Outstanding" value={formatCurrency(stats.totalOutstanding, true)} />
        </div>
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <LoanQueue
        endpoint="/collection/queue"
        emptyTitle="No active loans."
        emptyHint="Loans appear here once funds have been disbursed."
        refreshKey={refreshKey}
        renderActions={(loan) => (
          <Button variant="secondary" onClick={() => void openLoan(loan)}>
            Record payment
          </Button>
        )}
      />

      <Modal open={Boolean(target)} title="Record a payment" onClose={close}>
        <div className="space-y-5">
          {error ? <Alert tone="error">{error}</Alert> : null}

          {target ? (
            <dl className="divide-y divide-line border-y border-line text-sm">
              <div className="flex justify-between py-3">
                <dt className="text-muted">Loan</dt>
                <dd className="font-mono">{target.loanRef}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-muted">Total repayment</dt>
                <dd className="tabular-nums">{formatCurrency(target.totalRepayment)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-muted">Paid so far</dt>
                <dd className="tabular-nums">{formatCurrency(target.amountPaid)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt>Outstanding</dt>
                <dd className="tabular-nums">{formatCurrency(target.outstanding)}</dd>
              </div>
            </dl>
          ) : null}

          <Field
            label="UTR number"
            htmlFor="utr"
            hint="The bank reference for this transfer. It must not already exist in the system."
          >
            <TextInput
              id="utr"
              value={form.utrNumber}
              maxLength={32}
              className="uppercase"
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  utrNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                }))
              }
            />
          </Field>

          <Field
            label="Amount"
            htmlFor="amount"
            hint={target ? `At most ${formatCurrency(target.outstanding)}.` : undefined}
            error={amountInvalid && form.amount ? 'Enter an amount up to the outstanding balance.' : undefined}
          >
            <TextInput
              id="amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value.replace(/[^\d.]/g, '') }))
              }
            />
          </Field>

          <Field label="Payment date" htmlFor="paidAt">
            <TextInput
              id="paidAt"
              type="date"
              max={today()}
              value={form.paidAt}
              onChange={(e) => setForm((prev) => ({ ...prev, paidAt: e.target.value }))}
            />
          </Field>

          <Field label="Note" htmlFor="note" hint="Optional.">
            <TextInput
              id="note"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
          </Field>

          <div className="flex gap-2">
            <Button
              loading={busy}
              disabled={amountInvalid || form.utrNumber.length < 8}
              onClick={() => void submitPayment()}
            >
              Record payment
            </Button>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
          </div>

          {payments.length > 0 ? (
            <div className="pt-2">
              <h3 className="mb-3 text-sm">Earlier payments</h3>
              <Table>
                <thead>
                  <tr>
                    <Th>UTR</Th>
                    <Th>Date</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Balance after</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment._id}>
                      <Td>
                        <span className="font-mono text-xs">{payment.utrNumber}</span>
                      </Td>
                      <Td>{formatDate(payment.paidAt)}</Td>
                      <Td align="right">
                        <span className="tabular-nums">{formatCurrency(payment.amount)}</span>
                      </Td>
                      <Td align="right">
                        <span className="tabular-nums">
                          {formatCurrency(payment.outstandingAfter)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
