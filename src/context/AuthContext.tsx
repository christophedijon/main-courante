import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  userMetaReady: boolean;
  isSuperAdmin: boolean;
  userFonction: string | null;
  isDirection: boolean;
  isSecurite: boolean;
  isServeur: boolean;
  isChefDePoste: boolean;
  hasAdminAccess: boolean;
  hasChefDePosteAccess: boolean;
  hasMobileAccess: boolean;
  mustCompleteProfile: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  setProfileCompleted: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMetaReady, setUserMetaReady] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userFonction, setUserFonction] = useState<string | null>(null);
  const [mustCompleteProfile, setMustCompleteProfile] = useState(false);

  async function loadUserMeta(userEmail: string, userId: string) {
    try {
      const [adminRes, managedRes] = await Promise.all([
        supabase.from('super_admins').select('id').eq('email', userEmail).maybeSingle(),
        supabase.from('managed_users')
          .select('fonction, is_provisoire, profile_completed')
          .eq('auth_user_id', userId)
          .maybeSingle(),
      ]);
      setIsSuperAdmin(!!adminRes.data);
      setUserFonction(managedRes.data?.fonction ?? null);

      const mu = managedRes.data;
      if (mu?.is_provisoire === true && mu?.profile_completed === false) {
        setMustCompleteProfile(true);
      } else {
        setMustCompleteProfile(false);
      }
    } catch (err) {
      console.error('loadUserMeta error:', err);
      setIsSuperAdmin(false);
      setUserFonction(null);
      setMustCompleteProfile(false);
    } finally {
      setUserMetaReady(true);
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          try {
            await loadUserMeta(session.user.email!, session.user.id);
          } catch (err) {
            console.error('Auth loadUserMeta error:', err);
          } finally {
            setLoading(false);
          }
        })();
      } else {
        setIsSuperAdmin(false);
        setUserFonction(null);
        setMustCompleteProfile(false);
        setUserMetaReady(true);
        setLoading(false);
      }
    });

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
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
    setMustCompleteProfile(false);
  }

  async function setProfileCompleted() {
    const userId = session?.user.id;
    if (!userId) return;
    await supabase
      .from('managed_users')
      .update({ profile_completed: true, is_provisoire: false })
      .eq('auth_user_id', userId);
    setMustCompleteProfile(false);
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
        session, loading, userMetaReady, isSuperAdmin, userFonction,
        isDirection, isSecurite, isServeur, isChefDePoste,
        hasAdminAccess, hasChefDePosteAccess, hasMobileAccess,
        mustCompleteProfile,
        signIn, signOut, setProfileCompleted,
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
