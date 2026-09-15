'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Table, Th, Td, EmptyState } from '@/components/ui/Table';
import { StatusTag } from '@/components/ui/Status';
import { Alert } from '@/components/ui/Alert';
import { DocumentLink } from './DocumentLink';
import { Pagination } from './Pagination';
import { TextInput } from '@/components/ui/Field';
import { getList, ApiRequestError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Loan, PageMeta, PopulatedApplication, PopulatedUser } from '@/lib/types';

export function borrowerOf(loan: Loan): PopulatedUser | null {
  return typeof loan.userId === 'object' ? loan.userId : null;
}

export function applicationOf(loan: Loan): PopulatedApplication | null {
  return typeof loan.applicationId === 'object' ? loan.applicationId : null;
}

interface Props {
  endpoint: string;
  emptyTitle: string;
  emptyHint?: string;
  /** Rendered in the last column for each row. */
  renderActions: (loan: Loan, reload: () => void) => ReactNode;
  /** Bumped by the parent to force a refetch after an action. */
  refreshKey?: number;
}

export function LoanQueue({ endpoint, emptyTitle, emptyHint, renderActions, refreshKey = 0 }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) query.set('search', search.trim());
      const data = await getList<Loan>(`${endpoint}?${query.toString()}`);
      setLoans(data.items);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the queue.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, search]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <TextInput
          aria-label="Search by loan reference"
          placeholder="Search by loan reference"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="max-w-xs"
        />
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : loans.length === 0 ? (
        <EmptyState title={emptyTitle} {...(emptyHint ? { hint: emptyHint } : {})} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Loan</Th>
                <Th>Borrower</Th>
                <Th align="right">Principal</Th>
                <Th align="right">Repayment</Th>
                <Th>Status</Th>
                <Th>Document</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const borrower = borrowerOf(loan);
                const application = applicationOf(loan);
                return (
                  <tr key={loan._id}>
                    <Td>
                      <span className="font-mono text-xs">{loan.loanRef}</span>
                      <p className="mt-1 text-xs text-muted">{formatDate(loan.appliedAt)}</p>
                    </Td>
                    <Td>
                      <p>{borrower?.fullName ?? application?.fullName ?? '—'}</p>
                      <p className="mt-0.5 text-xs text-muted">{borrower?.email ?? ''}</p>
                      {application ? (
                        <p className="mt-0.5 font-mono text-xs text-muted">{application.panMasked}</p>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums">{formatCurrency(loan.principal, true)}</span>
                      <p className="mt-1 text-xs text-muted tabular-nums">{loan.tenureDays} days</p>
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums">{formatCurrency(loan.totalRepayment)}</span>
                      {loan.status === 'DISBURSED' ? (
                        <p className="mt-1 text-xs text-muted tabular-nums">
                          {formatCurrency(loan.outstanding)} left
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <StatusTag value={loan.status} />
                    </Td>
                    <Td>
                      <DocumentLink documentId={application?.documentId ?? null} />
                    </Td>
                    <Td align="right">{renderActions(loan, () => void load())}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}
    </div>
  );
}
