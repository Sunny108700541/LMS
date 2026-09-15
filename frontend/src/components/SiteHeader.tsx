'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { Button } from '@/components/ui/Button';
import { titleCase } from '@/lib/format';

export function SiteHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-bold tracking-tight">
          Loan Management System
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">
              {user.fullName} · {titleCase(user.role)}
            </span>
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm hover:underline">
              Sign in
            </Link>
            <Link
              href="/register"
              className="border border-black bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
