import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Wrench, LogOut } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextType } from '../context/AuthContext';

type EditorSession = {
  entrepriseId: string;
  entrepriseNom: string;
  editorMode: boolean;
};

function readEditorSession(): EditorSession | null {
  try {
    const raw = sessionStorage.getItem('editor_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditorSession;
    if (!parsed.editorMode) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Minimal fake session shape — just enough for existing pages not to navigate('/') on null check.
function buildMockSession(entrepriseNom: string): Session {
  return {
    user: {
      id: 'editor-support-mode',
      email: `support@sarlgreco.fr`,
      user_metadata: { full_name: `Éditeur — ${entrepriseNom}` },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      role: 'authenticated',
      updated_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      factors: [],
      identities: [],
    },
    access_token: 'editor-mode-token',
    refresh_token: 'editor-mode-refresh',
    expires_in: 99999,
    expires_at: Math.floor(Date.now() / 1000) + 99999,
    token_type: 'bearer',
  } as unknown as Session;
}

export default function EditorBackofficePage() {
  const navigate = useNavigate();
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);

  useEffect(() => {
    const session = readEditorSession();
    if (!session) {
      navigate('/editor', { replace: true });
      return;
    }
    setEditorSession(session);
  }, [navigate]);

  function handleTerminate() {
    sessionStorage.clear();
    navigate('/editor', { replace: true });
  }

  if (!editorSession) return null;

  const mockSignOut = async () => {
    sessionStorage.clear();
    navigate('/editor', { replace: true });
  };

  const mockAuthValue: AuthContextType = {
    session: buildMockSession(editorSession.entrepriseNom),
    loading: false,
    userMetaReady: true,
    isSuperAdmin: true,
    userFonction: 'Direction',
    isDirection: true,
    isSecurite: false,
    isServeur: false,
    isChefDePoste: false,
    hasAdminAccess: true,
    hasChefDePosteAccess: false,
    hasMobileAccess: true,
    mustCompleteProfile: false,
    signIn: async () => null,
    signOut: mockSignOut,
    setProfileCompleted: async () => {},
  };

  // BANNER_HEIGHT controls how far AppHeader's sticky top is offset
  const BANNER_H = 56; // px — matches h-14

  return (
    <AuthContext.Provider value={mockAuthValue}>
      {/*
        CSS override: push any `sticky` <header> inside .editor-page-body
        down by BANNER_H so it doesn't hide under the fixed banner.
      */}
      <style>{`
        .editor-page-body header {
          top: ${BANNER_H}px !important;
        }
      `}</style>

      {/* ── Fixed orange banner ─────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 sm:px-6 gap-4 shadow-lg"
        style={{ backgroundColor: '#f59e0b', height: `${BANNER_H}px` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Wrench className="w-4 h-4 shrink-0" style={{ color: '#1e293b' }} />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight" style={{ color: '#1e293b' }}>
              Session support éditeur active
            </p>
            <p className="text-xs leading-tight truncate" style={{ color: '#334155' }}>
              Établissement : {editorSession.entrepriseNom}
            </p>
          </div>
        </div>
        <button
          onClick={handleTerminate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
          style={{ backgroundColor: '#1e293b', color: '#f8fafc' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0f172a'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e293b'; }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Terminer la session
        </button>
      </div>

      {/* ── Page content — offset by banner height ─────────────────── */}
      <div className="editor-page-body" style={{ paddingTop: `${BANNER_H}px` }}>
        <Outlet />
      </div>
    </AuthContext.Provider>
  );
}
