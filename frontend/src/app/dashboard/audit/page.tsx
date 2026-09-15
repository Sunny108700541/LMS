'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Pagination } from '@/components/dashboard/Pagination';
import { Table, Th, Td, EmptyState } from '@/components/ui/Table';
import { Alert } from '@/components/ui/Alert';
import { getList, ApiRequestError } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import type { AuditLogEntry, PageMeta } from '@/lib/types';

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getList<AuditLogEntry>(`/admin/audit-logs?page=${page}&limit=25`);
      setEntries(data.items);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the activity log.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Every sign-in, decision and payment, with who did it and when."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Who</Th>
                <Th>Record</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const actor = typeof entry.actorId === 'object' && entry.actorId ? entry.actorId : null;
                return (
                  <tr key={entry._id}>
                    <Td>
                      <span className="text-xs text-muted">{formatDateTime(entry.createdAt)}</span>
                    </Td>
                    <Td>{titleCase(entry.action)}</Td>
                    <Td>
                      <p className="text-xs">{actor?.fullName ?? 'System'}</p>
                      {entry.actorRole ? (
                        <p className="mt-0.5 text-xs text-muted">{titleCase(entry.actorRole)}</p>
                      ) : null}
                    </Td>
                    <Td>
                      <p className="text-xs">{entry.entityType}</p>
                      {entry.entityId ? (
                        <p className="mt-0.5 font-mono text-xs text-muted">{entry.entityId}</p>
                      ) : null}
                    </Td>
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
