'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect } from 'react';
import useAuthStore, { type AuthProfile, type AuthSession } from '@/lib/stores/useAuthStore';

type AuthSessionSyncProps = {
  children: React.ReactNode;
};

export function AuthSessionSync({ children }: AuthSessionSyncProps): JSX.Element {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    const supabase = createClientComponentClient();

    const synchronize = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        clearSession();
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id, school_id, role, first_name, last_name, email')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile) {
        setSession({ session: session as AuthSession, profile: profile as AuthProfile });
      } else {
        clearSession();
      }
    };

    void synchronize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void synchronize();
    });

    return () => subscription.unsubscribe();
  }, [clearSession, setSession]);

  return <>{children}</>;
}
