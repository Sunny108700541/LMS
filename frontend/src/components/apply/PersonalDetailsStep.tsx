'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { api, ApiRequestError, type ApiErrorDetail } from '@/lib/api';
import { previewEligibility } from '@/lib/bre';
import type { Application, EmploymentMode } from '@/lib/types';

interface Props {
  onCompleted: (application: Application) => void;
}

export function PersonalDetailsStep({ onCompleted }: Props) {
  const [form, setForm] = useState({
    fullName: '',
    pan: '',
    dateOfBirth: '',
    monthlySalary: '',
    employmentMode: '' as EmploymentMode | '',
  });
  const [serverFailures, setServerFailures] = useState<ApiErrorDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Instant feedback while typing. The server re-runs the same rules on submit.
  const preview = useMemo(
    () =>
      previewEligibility({
        pan: form.pan,
        dateOfBirth: form.dateOfBirth,
        monthlySalary: Number(form.monthlySalary || 0),
        employmentMode: form.employmentMode,
      }),
    [form],
  );

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setServerFailures([]);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const data = await api.post<{ application: Application }>('/applications/personal-details', {
        fullName: form.fullName,
        pan: form.pan.toUpperCase(),
        dateOfBirth: form.dateOfBirth,
        monthlySalary: Number(form.monthlySalary),
        employmentMode: form.employmentMode,
      });
      onCompleted(data.application);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        if (err.code === 'UNPROCESSABLE_ENTITY') setServerFailures(err.details);
        setFieldErrors(
          Object.fromEntries(
            err.details.filter((d) => d.field).map((d) => [d.field as string, d.message]),
          ),
        );
      } else {
        setError('Could not save your details. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <Alert tone="error" title={serverFailures.length ? 'You are not eligible' : undefined}>
          {serverFailures.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {serverFailures.map((failure, index) => (
                <li key={index}>{failure.message}</li>
              ))}
            </ul>
          ) : (
            error
          )}
        </Alert>
      ) : null}

      <Field label="Full name (as on PAN)" htmlFor="fullName" error={fieldErrors.fullName}>
        <TextInput
          id="fullName"
          required
          value={form.fullName}
          onChange={(e) => update('fullName', e.target.value)}
        />
      </Field>

      <Field label="PAN" htmlFor="pan" hint="Ten characters, like ABCDE1234F." error={fieldErrors.pan}>
        <TextInput
          id="pan"
          required
          maxLength={10}
          className="uppercase"
          value={form.pan}
          onChange={(e) => update('pan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
      </Field>

      <Field
        label="Date of birth"
        htmlFor="dateOfBirth"
        hint="You must be between 23 and 50."
        error={fieldErrors.dateOfBirth}
      >
        <TextInput
          id="dateOfBirth"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          value={form.dateOfBirth}
          onChange={(e) => update('dateOfBirth', e.target.value)}
        />
      </Field>

      <Field
        label="Monthly salary"
        htmlFor="monthlySalary"
        hint="In rupees, before deductions. Minimum ₹25,000."
        error={fieldErrors.monthlySalary}
      >
        <TextInput
          id="monthlySalary"
          inputMode="numeric"
          required
          value={form.monthlySalary}
          onChange={(e) => update('monthlySalary', e.target.value.replace(/\D/g, ''))}
        />
      </Field>

      <Field label="Employment" htmlFor="employmentMode" error={fieldErrors.employmentMode}>
        <Select
          id="employmentMode"
          required
          value={form.employmentMode}
          onChange={(e) => update('employmentMode', e.target.value)}
        >
          <option value="">Select one</option>
          <option value="SALARIED">Salaried</option>
          <option value="SELF_EMPLOYED">Self-employed</option>
          <option value="UNEMPLOYED">Unemployed</option>
        </Select>
      </Field>

      {preview.length > 0 ? (
        <Alert tone="error" title="These will block your application">
          <ul className="list-disc space-y-1 pl-5">
            {preview.map((failure) => (
              <li key={failure.rule}>{failure.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Button type="submit" loading={submitting}>
        Check eligibility and continue
      </Button>
    </form>
  );
}
