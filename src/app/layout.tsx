import type { Metadata } from 'next';
import { AuthSessionSync } from '@/components/auth/AuthSessionSync';

export const metadata: Metadata = {
  title: 'Smart School ERP',
  description: 'Multi-tenant school management platform',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthSessionSync>{children}</AuthSessionSync>
      </body>
    </html>
  );
}
