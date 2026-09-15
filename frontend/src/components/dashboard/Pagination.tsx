'use client';

import { Button } from '@/components/ui/Button';
import type { PageMeta } from '@/lib/types';

export function Pagination({ meta, onChange }: { meta: PageMeta; onChange: (page: number) => void }) {
  if (meta.total === 0) return null;

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted tabular-nums">
        {from}–{to} of {meta.total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => onChange(meta.page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onChange(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
