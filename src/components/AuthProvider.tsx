'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import useAuthStore, { type AuthProfile } from '@/lib/stores/useAuthStore';
import { supabase } from '@/lib/supabase/client';

const AUTH_ROLES = new Set(['admin', 'school_admin', 'super_admin', 'teacher', 'student', 'parent']);

function isAuthProfile(value: unknown): value is AuthProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === 'string' &&
    typeof profile.user_id === 'string' &&
    typeof profile.school_id === 'string' &&
    typeof profile.role === 'string' &&
    AUTH_ROLES.has(profile.role) &&
    profile.is_active === true
  );
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    let mounted = true;

    const syncSession = async (session: Session | null) => {
      if (!session) {
        clearSession();
        setError(null);
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!mounted) return;
      if (profileError) {
        clearSession();
        setError(`Unable to load your profile: ${profileError.message}`);
        setLoading(false);
        return;
      }
      if (!isAuthProfile(profile)) {
        clearSession();
        setError('Your account does not have a valid school profile. Contact your school administrator.');
        setLoading(false);
        return;
      }

      setSession({ session, profile });
      setError(null);
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (mounted) void syncSession(session);
      });
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) {
        clearSession();
        setError(`Unable to restore your session: ${sessionError.message}`);
        setLoading(false);
        return;
      }
      void syncSession(data.session);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [clearSession, setSession]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50" aria-live="polite">
        <p className="text-sm font-medium text-slate-600">Restoring your session…</p>
      </main>
    );
  }

  return (
    <>
      {error && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900" role="alert">
          {error}
        </div>
      )}
      {children}
    </>
  );
}
