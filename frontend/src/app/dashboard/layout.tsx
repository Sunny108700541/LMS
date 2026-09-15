'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { useAuth } from '@/context/AuthProvider';
import { DASHBOARD_NAV, canAccess } from '@/lib/roles';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Borrowers have no dashboard. The API rejects them too; this just avoids a dead screen.
  useEffect(() => {
    if (!loading && user?.role === 'BORROWER') router.replace('/apply');
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user || user.role === 'BORROWER') {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      </div>
    );
  }

  const items = DASHBOARD_NAV.filter((item) => canAccess(user.role, item));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
        <nav aria-label="Modules" className="lg:w-48 lg:shrink-0">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block border px-3 py-2 text-sm ${
                      active ? 'border-black bg-black text-white' : 'border-line hover:border-black'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
