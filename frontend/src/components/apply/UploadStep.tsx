'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { api, ApiRequestError } from '@/lib/api';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png'];

interface Props {
  applicationId: string;
  alreadyUploaded: boolean;
  onCompleted: () => void;
}

export function UploadStep({ applicationId, alreadyUploaded, onCompleted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSelect(selected: File | null) {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ACCEPTED.includes(selected.type)) {
      setError('Choose a PDF, JPG or PNG file.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('The file must be 5 MB or smaller.');
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.upload(`/applications/${applicationId}/documents`, formData);
      onCompleted();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Upload failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {alreadyUploaded ? (
        <Alert tone="success">
          A salary slip is on file. Upload another to replace it, or continue.
        </Alert>
      ) : null}

      <div className="border border-line p-6">
        <label htmlFor="file" className="block text-sm">
          Latest salary slip
        </label>
        <p className="mt-1 text-xs text-muted">PDF, JPG or PNG. Up to 5 MB.</p>
        <input
          id="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
          className="mt-4 block w-full text-sm file:mr-4 file:border file:border-black file:bg-white file:px-4 file:py-2 file:text-sm file:text-black hover:file:bg-subtle"
        />
        {file ? (
          <p className="mt-3 text-sm text-muted">
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button type="submit" loading={submitting} disabled={!file}>
          Upload and continue
        </Button>
        {alreadyUploaded ? (
          <Button type="button" variant="secondary" onClick={onCompleted}>
            Keep current file
          </Button>
        ) : null}
      </div>
    </form>
  );
}
