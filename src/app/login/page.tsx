'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import useAuthStore from '@/lib/stores/useAuthStore';
import { processSecureRedirects } from '@/lib/routes/routing_security';

export default function LoginPage(): JSX.Element {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClientComponentClient();

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

      // Fetch user profile directly from PostgreSQL using Supabase client
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (profileError) {
        const message = profileError.message || 'Failed to fetch user profile.';
        // Provide more actionable guidance when profile is missing or not provisioned
        if (profileError.code === 'PGRST116' || profileError.message?.includes('No rows')) {
          setError('No user profile found. Your authentication succeeded but your account is not yet provisioned in the school database. Please contact your administrator.');
        } else {
          setError(message + ' If this persists contact your administrator.');
        }
        setLoading(false);
        return;
      }

      if (!profile) {
        setError('No user profile found. Your authentication succeeded but your account is not yet provisioned in the school database. Please contact your administrator.');
        setLoading(false);
        return;
      }

      // Persist session and profile to the Zustand store
      useAuthStore.getState().setSession({ session, profile });

      // Execute routing logic using processSecureRedirects
      try {
        const redirectPath = await processSecureRedirects(
          { role: profile?.role, roles: profile?.roles },
          { pathname: '/' }
        );
        if (redirectPath) {
          router.push(redirectPath);
          return;
        }
      } catch (e) {
        // ignore and use default
      }

      // Default fallback
      router.push('/dashboard');
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
