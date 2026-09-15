'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { api, ApiRequestError, type ApiErrorDetail } from '@/lib/api';
import { useAuth } from '@/context/AuthProvider';
import type { User } from '@/lib/types';

import { setSessionIndicator } from '@/lib/session';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const data = await api.post<{ user: User }>('/auth/register', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        ...(form.phone ? { phone: form.phone } : {}),
      });
      setUser(data.user);
      setSessionIndicator();
      router.replace('/apply');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFieldErrors(
          Object.fromEntries(
            err.details
              .filter((d: ApiErrorDetail) => d.field)
              .map((d: ApiErrorDetail) => [d.field as string, d.message]),
          ),
        );
      } else {
        setError('Could not create the account. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl">Create your account</h1>
        <p className="mt-2 text-sm text-muted">This takes a minute. You can apply right after.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
            <TextInput
              id="fullName"
              autoComplete="name"
              required
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </Field>

          <Field
            label="Mobile number"
            htmlFor="phone"
            hint="Optional. 10 digits, no country code."
            error={fieldErrors.phone}
          >
            <TextInput
              id="phone"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value.replace(/\D/g, ''))}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
            error={fieldErrors.password}
          >
            <TextInput
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </Field>

          <Button type="submit" loading={submitting} className="w-full">
            Create account
          </Button>

          <p className="text-sm text-muted">
            Already registered?{' '}
            <Link href="/login" className="text-black underline">
              Sign in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
