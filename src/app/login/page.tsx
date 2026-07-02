'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import useAuthStore from '@/lib/stores/useAuthStore';
import { decodeJwtPayload } from '@/lib/utils/jwt';

// Ensure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set in your environment.
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // We do not throw here since this file might be statically analyzed. Instead, we will guard at runtime.
}

function getSupabaseClient(): SupabaseClient {
  return createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: true }
  });
}

type AuthError = {
  message: string;
};

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const setSession = useAuthStore((s: any) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase client not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      }

      const supabase = getSupabaseClient();

      const {
        data: signInData,
        error: signInError
      } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        const message = signInError.message || 'Authentication failed. Please check your credentials.';
        setError(message);
        setLoading(false);
        return;
      }

      const session = signInData?.session ?? null;
      if (!session) {
        setError('No session returned from authentication.');
        setLoading(false);
        return;
      }

      // Decode the access token payload to extract roles/metadata
      const accessToken = session.access_token;
      const payload = accessToken ? decodeJwtPayload(accessToken) : null;

      const roles = payload?.role || payload?.roles || payload?.['x-hasura-allowed-roles'] || null;
      const metadata = payload?.user_metadata || payload?.app_metadata || null;

      // Persist session to the Zustand store
      setSession({ session, roles, metadata });

      // Determine and navigate to the user's dashboard. If your routing helper is available on client,
      // you can import and use it to compute the redirect path. As a safe default, route to '/dashboard'.
      const defaultPath = '/dashboard';
      try {
        // Attempt to call a client-friendly routing helper if available
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { processSecureRedirects } = require('@/lib/routes/routing_security');
        if (typeof processSecureRedirects === 'function') {
          const maybeRedirect = await processSecureRedirects(payload, { pathname: '/' });
          if (maybeRedirect) {
            router.push(maybeRedirect);
            return;
          }
        }
      } catch (e) {
        // ignore and use default
      }

      router.push(defaultPath);
    } catch (err: any) {
      setError(err?.message ?? 'Unknown authentication error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-semibold mb-6 text-gray-800">Secure Login</h1>
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 p-3 rounded">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
        <p className="mt-4 text-sm text-gray-500">If you have trouble signing in, contact your administrator.</p>
      </div>
    </div>
  );
}
