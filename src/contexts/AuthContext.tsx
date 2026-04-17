import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'agent' | 'team_lead' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: { full_name: string; email: string } | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authRequestRef = useRef(0);

  const fetchRoleAndProfile = async (userId: string, retries = 3): Promise<{ role: AppRole | null; profile: { full_name: string; email: string } | null }> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const [roleResult, profileResult] = await Promise.all([
        supabase.rpc('get_user_role', { _user_id: userId }),
        supabase.from('profiles').select('full_name, email').eq('id', userId).single(),
      ]);

      if (roleResult.error) {
        console.warn(`[Auth] get_user_role attempt ${attempt + 1} failed:`, roleResult.error.message);
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
      }

      return {
        role: roleResult.data ? (roleResult.data as AppRole) : null,
        profile: profileResult.data
          ? {
              full_name: profileResult.data.full_name || '',
              email: profileResult.data.email || '',
            }
          : null,
      };
    }
    return { role: null, profile: null };
  };

  useEffect(() => {
    let mounted = true;

    const lastUserIdRef = { current: null as string | null };

    const syncSession = async (nextSession: Session | null) => {
      const requestId = ++authRequestRef.current;

      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        lastUserIdRef.current = null;
        setRole(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // If same user (token refresh), keep existing role/profile — don't flash null
      const isSameUser = lastUserIdRef.current === nextSession.user.id;
      if (!isSameUser) {
        setIsLoading(true);
        setRole(null);
        setProfile(null);
      }
      lastUserIdRef.current = nextSession.user.id;

      try {
        const resolved = await fetchRoleAndProfile(nextSession.user.id);
        if (!mounted || authRequestRef.current !== requestId) return;

        setRole(resolved.role);
        setProfile(resolved.profile);
      } finally {
        if (mounted && authRequestRef.current === requestId) {
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      window.setTimeout(() => {
        void syncSession(newSession);
      }, 0);
    });

    void supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      void syncSession(existingSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    session,
    role,
    isAuthenticated: !!session,
    isLoading,
    profile,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
