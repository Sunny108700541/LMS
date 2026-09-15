'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Pagination } from '@/components/dashboard/Pagination';
import { Table, Th, Td, EmptyState } from '@/components/ui/Table';
import { StatusTag } from '@/components/ui/Status';
import { Stat } from '@/components/ui/Stat';
import { Alert } from '@/components/ui/Alert';
import { TextInput } from '@/components/ui/Field';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { api, getList, ApiRequestError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Lead, PageMeta, AnalyticsData, BorrowerLoan } from '@/lib/types';

interface SalesStats {
  totalBorrowers: number;
  openLeads: number;
  inProgress: number;
  breRejected: number;
  converted: number;
}

/* ── tiny section divider ─────────────────────────────────────────── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold uppercase tracking-wide text-black">{children}</span>
      <span className="flex-1 border-t border-line" />
    </div>
  );
}

/* ── progress bar for repayment ───────────────────────────────────── */
function RepayBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? '#10b981' : pct > 50 ? '#6366f1' : '#f59e0b',
          }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted">{pct}%</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Page
════════════════════════════════════════════════════════════════════ */
export default function SalesPage() {
  // ── leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // ── borrowers
  const [borrowers, setBorrowers] = useState<BorrowerLoan[]>([]);
  const [borrowerMeta, setBorrowerMeta] = useState<PageMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [borrowerPage, setBorrowerPage] = useState(1);
  const [borrowersLoading, setBorrowersLoading] = useState(true);

  /* ── fetch leads & stats ────────────────────────────────────────── */
  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) query.set('search', search.trim());
      const [leadData, statsData] = await Promise.all([
        getList<Lead>(`/sales/leads?${query.toString()}`),
        api.get<SalesStats>('/sales/stats'),
      ]);
      setLeads(leadData.items);
      setMeta(leadData.meta);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  /* ── fetch analytics (once) ─────────────────────────────────────── */
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const data = await api.get<AnalyticsData>('/sales/analytics');
      setAnalytics(data);
    } catch (err) {
      setAnalyticsError(err instanceof ApiRequestError ? err.message : 'Could not load analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  /* ── fetch borrowers ────────────────────────────────────────────── */
  const loadBorrowers = useCallback(async () => {
    setBorrowersLoading(true);
    try {
      const query = new URLSearchParams({ page: String(borrowerPage), limit: '10' });
      const data = await getList<BorrowerLoan>(`/sales/borrowers?${query.toString()}`);
      setBorrowers(data.items);
      setBorrowerMeta(data.meta);
    } catch {
      // non-blocking; borrower table shows nothing
    } finally {
      setBorrowersLoading(false);
    }
  }, [borrowerPage]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);
  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { void loadBorrowers(); }, [loadBorrowers]);

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-8">
      <PageHeader
        title="Sales"
        description="People who have registered but have not raised a loan yet. Follow up where they stalled."
      />

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Open leads" value={stats.openLeads} />
          <Stat label="Application started" value={stats.inProgress} />
          <Stat label="Failed eligibility" value={stats.breRejected} />
          <Stat label="Converted to loans" value={stats.converted} />
        </div>
      ) : null}

      {/* ── Portfolio stat cards (from analytics) ──────────────────── */}
      {analytics?.portfolio ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total sanctioned"
            value={formatCurrency(analytics.portfolio.totalPrincipalSanctioned, true)}
          />
          <Stat
            label="Total collected"
            value={formatCurrency(analytics.portfolio.totalAmountCollected, true)}
          />
          <Stat
            label="Total outstanding"
            value={formatCurrency(analytics.portfolio.totalOutstanding, true)}
          />
          <Stat
            label="Conversion rate"
            value={`${analytics.portfolio.conversionRate}%`}
          />
        </div>
      ) : null}

      {/* ── Charts ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeading>Analytics</SectionHeading>
        {analyticsError ? (
          <Alert tone="error">{analyticsError}</Alert>
        ) : analyticsLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[...Array<null>(4)].map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl border border-line bg-gray-50"
              />
            ))}
          </div>
        ) : analytics ? (
          <AnalyticsCharts data={analytics} />
        ) : null}
      </div>

      {/* ── Loan Borrowers table ────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeading>Loan Borrowers</SectionHeading>
        {borrowersLoading ? (
          <p className="text-sm text-muted">Loading borrowers…</p>
        ) : borrowers.length === 0 ? (
          <EmptyState title="No loans yet." hint="Borrowers who get a loan will appear here." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Borrower</Th>
                  <Th>Loan ref</Th>
                  <Th align="right">Principal</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Outstanding</Th>
                  <Th>Repayment</Th>
                  <Th>Status</Th>
                  <Th>Disbursed</Th>
                </tr>
              </thead>
              <tbody>
                {borrowers.map((b) => (
                  <tr key={b.loanId}>
                    <Td>
                      <p className="font-medium">{b.borrowerName}</p>
                      <p className="mt-0.5 text-xs text-muted">{b.borrowerEmail}</p>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs">{b.loanRef}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums">{formatCurrency(b.principal, true)}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums text-emerald-600">
                        {formatCurrency(b.amountPaid, true)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        className={`tabular-nums ${
                          b.outstanding === 0 ? 'text-muted' : 'text-amber-600'
                        }`}
                      >
                        {b.outstanding === 0 ? '—' : formatCurrency(b.outstanding, true)}
                      </span>
                    </Td>
                    <Td>
                      <RepayBar
                        paid={b.amountPaid}
                        total={b.principal + (b.amountPaid + b.outstanding - b.principal)}
                      />
                    </Td>
                    <Td>
                      <StatusTag value={b.status} />
                    </Td>
                    <Td>{formatDate(b.disbursedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={borrowerMeta} onChange={setBorrowerPage} />
          </>
        )}
      </div>

      {/* ── Open leads table ────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeading>Open Leads</SectionHeading>

        <TextInput
          aria-label="Search leads by name or email"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="max-w-xs"
        />

        {error ? <Alert tone="error">{error}</Alert> : null}

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : leads.length === 0 ? (
          <EmptyState title="No open leads." hint="Everyone who registered has applied." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Stage</Th>
                  <Th align="right">Declared salary</Th>
                  <Th>Registered</Th>
                  <Th>Blocked by</Th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.userId}>
                    <Td>
                      <p>{lead.fullName}</p>
                      {lead.panMasked ? (
                        <p className="mt-0.5 font-mono text-xs text-muted">{lead.panMasked}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <p className="text-xs">{lead.email}</p>
                      {lead.phone ? (
                        <p className="mt-0.5 text-xs text-muted">{lead.phone}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <StatusTag value={lead.stage} />
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums">
                        {lead.monthlySalary ? formatCurrency(lead.monthlySalary, true) : '—'}
                      </span>
                    </Td>
                    <Td>{formatDate(lead.registeredAt)}</Td>
                    <Td>
                      {lead.breFailures.length ? (
                        <span className="text-xs text-negative">
                          {lead.breFailures.join(', ')}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={meta} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
