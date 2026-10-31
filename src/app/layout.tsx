import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthSessionSync } from '@/components/auth/AuthSessionSync';

export const metadata: Metadata = {
  title: 'Smart School ERP',
  description: 'Multi-tenant school management platform for schools in Uganda and East Africa.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthSessionSync>{children}</AuthSessionSync>
      </body>
    </html>
  );
}
