'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { SiteHeader } from '@/components/SiteHeader';
import { ROLE_HOME } from '@/lib/roles';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Signed-in people go straight to the surface their role owns.
  useEffect(() => {
    if (!loading && user) router.replace(ROLE_HOME[user.role]);
  }, [user, loading, router]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-prose">
          <h1 className="text-3xl leading-tight sm:text-4xl">
            Borrow up to ₹5,00,000 at a flat 12% a year.
          </h1>
          <p className="mt-4 text-base text-muted">
            Four steps: create an account, share your details, upload a salary slip, pick your amount
            and tenure. You will see the exact repayment before you apply.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="border border-black bg-black px-5 py-2.5 text-sm text-white hover:bg-neutral-800"
            >
              Start an application
            </Link>
            <Link href="/login" className="border border-line px-5 py-2.5 text-sm hover:border-black">
              Sign in
            </Link>
          </div>
        </div>

        <dl className="mt-16 grid gap-px border border-line bg-line sm:grid-cols-3">
          <div className="bg-white p-6">
            <dt className="text-sm text-muted">Amount</dt>
            <dd className="mt-1 text-lg">₹50,000 – ₹5,00,000</dd>
          </div>
          <div className="bg-white p-6">
            <dt className="text-sm text-muted">Tenure</dt>
            <dd className="mt-1 text-lg">30 – 365 days</dd>
          </div>
          <div className="bg-white p-6">
            <dt className="text-sm text-muted">Interest</dt>
            <dd className="mt-1 text-lg">12% a year, simple</dd>
          </div>
        </dl>

        <p className="mt-10 max-w-prose text-sm text-muted">
          Eligibility: age 23–50, monthly income of ₹25,000 or more, a valid PAN, and current
          employment.
        </p>
      </main>
    </div>
  );
}
