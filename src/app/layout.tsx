import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Smart School ERP',
  description: 'Multi-tenant school management and academic dashboard platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
