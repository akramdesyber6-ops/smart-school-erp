import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

export interface AuthProfile {
  id: string;
  user_id: string;
  school_id: string;
  role: 'admin' | 'school_admin' | 'teacher' | 'student' | 'parent';
  roles?: string[];
  first_name?: string;
  last_name?: string;
  email?: string;
  [key: string]: any;
}

export type AuthSession = Session;

export interface AuthStoreState {
  session: AuthSession | null;
  profile: AuthProfile | null;
  activeSchoolId: string | null;
  setSession: (data: { session: AuthSession; profile: AuthProfile }) => void;
  clearSession: () => void;
  setActiveSchool: (schoolId: string) => void;
}

const useAuthStore = create<AuthStoreState>((set) => ({
  session: null,
  profile: null,
  activeSchoolId: null,

  setSession: (data: { session: AuthSession; profile: AuthProfile }) => {
    set((state) => ({
      session: data.session,
      profile: data.profile,
      activeSchoolId: data.profile?.school_id || state.activeSchoolId,
    }));
  },

  clearSession: () => {
    set({
      session: null,
      profile: null,
      activeSchoolId: null,
    });
  },

  setActiveSchool: (schoolId: string) => {
    set({ activeSchoolId: schoolId });
  },
}));

export default useAuthStore;
