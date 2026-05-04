import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  isSuperAdmin: boolean;
  userFonction: string | null;
  isDirection: boolean;
  isSecurite: boolean;
  isServeur: boolean;
  isChefDePoste: boolean;
  hasAdminAccess: boolean;
  hasChefDePosteAccess: boolean;
  hasMobileAccess: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userFonction, setUserFonction] = useState<string | null>(null);

  async function loadUserMeta(userEmail: string, userId: string) {
    const [adminRes, managedRes] = await Promise.all([
      supabase.from('super_admins').select('id').eq('email', userEmail).maybeSingle(),
      supabase.from('managed_users').select('fonction').eq('auth_user_id', userId).maybeSingle(),
    ]);
    setIsSuperAdmin(!!adminRes.data || managedRes.data?.fonction === 'Direction');
    setUserFonction(managedRes.data?.fonction ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadUserMeta(data.session.user.email!, data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => { await loadUserMeta(session.user.email!, session.user.id); })();
      } else {
        setIsSuperAdmin(false);
        setUserFonction(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsSuperAdmin(false);
    setUserFonction(null);
  }

  const isDirection = userFonction === 'Direction';
  const isSecurite = userFonction === 'Agent de Sécurité' || userFonction === 'Sécurité';
  const isServeur = userFonction === 'Serveur';
  const isChefDePoste = userFonction === 'Chef de poste';
  const hasAdminAccess = isSuperAdmin || isDirection || isChefDePoste;
  const hasChefDePosteAccess = isChefDePoste;
  const hasMobileAccess = !!session;

  return (
    <AuthContext.Provider
      value={{
        session, loading, isSuperAdmin, userFonction,
        isDirection, isSecurite, isServeur, isChefDePoste,
        hasAdminAccess, hasChefDePosteAccess, hasMobileAccess,
        signIn, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
