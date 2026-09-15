'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { api, ApiRequestError } from '@/lib/api';

/**
 * One-time admin setup. Nothing is seeded: the first admin is created here with
 * the bootstrap token from the server environment, and the API refuses to
 * create a second one.
 */
export default function SetupPage() {
  const [form, setForm] = useState({ bootstrapToken: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/bootstrap-admin', form);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create the admin account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl">Create the admin account</h1>
        <p className="mt-2 text-sm text-muted">
          Runs once. The system allows exactly one admin, who then creates every other account.
        </p>

        {done ? (
          <div className="mt-8 space-y-4">
            <Alert tone="success" title="Admin created">
              Sign in to create your Sales, Sanction, Disbursement and Collection accounts.
            </Alert>
            <Link
              href="/login"
              className="inline-block border border-black bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {error ? <Alert tone="error">{error}</Alert> : null}

            <Field
              label="Bootstrap token"
              htmlFor="bootstrapToken"
              hint="The ADMIN_BOOTSTRAP_TOKEN value from the server environment."
            >
              <TextInput
                id="bootstrapToken"
                type="password"
                required
                value={form.bootstrapToken}
                onChange={(e) => update('bootstrapToken', e.target.value)}
              />
            </Field>

            <Field label="Full name" htmlFor="fullName">
              <TextInput
                id="fullName"
                required
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
              />
            </Field>

            <Field label="Email" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
            >
              <TextInput
                id="password"
                type="password"
                required
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
            </Field>

            <Button type="submit" loading={submitting} className="w-full">
              Create admin account
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
