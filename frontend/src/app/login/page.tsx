'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/context/AuthProvider';
import { ROLE_HOME } from '@/lib/roles';
import type { User } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post<{ user: User }>('/auth/login', { email, password });
      setUser(data.user);
      const next = params.get('next');
      router.replace(next && next.startsWith('/') ? next : ROLE_HOME[data.user.role]);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not sign in. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field label="Email" htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Button type="submit" loading={submitting} className="w-full">
        Sign in
      </Button>

      <p className="text-sm text-muted">
        No account yet?{' '}
        <Link href="/register" className="text-black underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <h1 className="text-2xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Borrowers and team members use the same sign-in.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
