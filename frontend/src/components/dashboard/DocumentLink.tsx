'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';

/**
 * Salary slips live in a private bucket. This asks the API for a short-lived
 * signed URL at click time rather than holding a link that could be shared.
 */
export function DocumentLink({ documentId }: { documentId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!documentId) return <span className="text-sm text-muted">No file</span>;

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.get<{ url: string }>(`/applications/documents/${documentId}/url`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not open the document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void open()} disabled={busy} className="text-sm underline">
        {busy ? 'Opening…' : 'Salary slip'}
      </button>
      {error ? <p className="mt-1 text-xs text-negative">{error}</p> : null}
    </div>
  );
}
