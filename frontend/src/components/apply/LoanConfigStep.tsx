'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api, ApiRequestError } from '@/lib/api';
import { calculateQuote, LOAN_LIMITS } from '@/lib/loan';
import { formatCurrency } from '@/lib/format';
import type { Loan } from '@/lib/types';

interface Props {
  onApplied: (loan: Loan) => void;
}

export function LoanConfigStep({ onApplied }: Props) {
  const [principal, setPrincipal] = useState(150_000);
  const [tenureDays, setTenureDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recomputed on every slider move — this is the live panel.
  const quote = useMemo(() => calculateQuote(principal, tenureDays), [principal, tenureDays]);

  async function handleApply() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post<{ loan: Loan }>('/loans', { principal, tenureDays });
      onApplied(data.loan);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit the application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-6">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="principal" className="text-sm">
              Loan amount
            </label>
            <output htmlFor="principal" className="text-lg tabular-nums">
              {formatCurrency(principal, true)}
            </output>
          </div>
          <input
            id="principal"
            type="range"
            className="mt-3"
            min={LOAN_LIMITS.MIN_PRINCIPAL}
            max={LOAN_LIMITS.MAX_PRINCIPAL}
            step={LOAN_LIMITS.PRINCIPAL_STEP}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{formatCurrency(LOAN_LIMITS.MIN_PRINCIPAL, true)}</span>
            <span>{formatCurrency(LOAN_LIMITS.MAX_PRINCIPAL, true)}</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="tenure" className="text-sm">
              Tenure
            </label>
            <output htmlFor="tenure" className="text-lg tabular-nums">
              {tenureDays} days
            </output>
          </div>
          <input
            id="tenure"
            type="range"
            className="mt-3"
            min={LOAN_LIMITS.MIN_TENURE_DAYS}
            max={LOAN_LIMITS.MAX_TENURE_DAYS}
            step={LOAN_LIMITS.TENURE_STEP}
            value={tenureDays}
            onChange={(e) => setTenureDays(Number(e.target.value))}
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{LOAN_LIMITS.MIN_TENURE_DAYS} days</span>
            <span>{LOAN_LIMITS.MAX_TENURE_DAYS} days</span>
          </div>
        </div>
      </div>

      <dl className="divide-y divide-line border-y border-line">
        <div className="flex justify-between py-3 text-sm">
          <dt className="text-muted">Principal</dt>
          <dd className="tabular-nums">{formatCurrency(quote.principal)}</dd>
        </div>
        <div className="flex justify-between py-3 text-sm">
          <dt className="text-muted">Interest rate</dt>
          <dd className="tabular-nums">{quote.interestRate}% a year, simple</dd>
        </div>
        <div className="flex justify-between py-3 text-sm">
          <dt className="text-muted">Interest for {quote.tenureDays} days</dt>
          <dd className="tabular-nums">{formatCurrency(quote.simpleInterest)}</dd>
        </div>
        <div className="flex justify-between py-4">
          <dt>Total repayment</dt>
          <dd className="text-lg tabular-nums">{formatCurrency(quote.totalRepayment)}</dd>
        </div>
      </dl>

      <p className="text-xs text-muted">
        Interest is calculated as principal × 12% × days ÷ 365. The final figures are confirmed by
        our server when you apply.
      </p>

      <Button onClick={handleApply} loading={submitting}>
        Apply for this loan
      </Button>
    </div>
  );
}
