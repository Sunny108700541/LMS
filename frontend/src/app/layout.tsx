import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Loan Management System',
  description: 'Apply for a loan and manage the lending lifecycle end to end.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-black antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
