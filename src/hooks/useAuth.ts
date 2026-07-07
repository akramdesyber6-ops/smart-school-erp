'use client';

/**
 * Custom React Hook: useAuth
 * Manages user authentication state from Supabase
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/services/assessment.service';
import type { User } from '@supabase/supabase-js';

export interface UseAuthResult {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

/**
 * Hook to manage authentication state
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get current session
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
        } else {
          setUser(data?.session?.user || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  return { user, loading, error, logout };
}
