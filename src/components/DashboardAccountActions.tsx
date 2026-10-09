'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/stores/useAuthStore';
import { supabase } from '@/lib/supabase/client';

export default function DashboardAccountActions() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(`Unable to sign out: ${signOutError.message}`);
      setSigningOut(false);
      return;
    }
    clearSession();
    router.replace('/login');
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {profile?.email && (
        <span className="max-w-56 truncate text-sm text-slate-600" title={profile.email}>
          {profile.email}
        </span>
      )}
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p className="basis-full text-right text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
