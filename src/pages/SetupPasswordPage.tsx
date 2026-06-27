import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

type CheckState = { label: string; ok: boolean };

function passwordChecks(pwd: string): CheckState[] {
  return [
    { label: '8 caractères minimum', ok: pwd.length >= 8 },
    { label: '1 lettre majuscule',   ok: /[A-Z]/.test(pwd) },
    { label: '1 chiffre',            ok: /[0-9]/.test(pwd) },
  ];
}

export default function SetupPasswordPage() {
  const navigate = useNavigate();

  const [session, setSession]       = useState<Session | null>(null);
  const [firstName, setFirstName]   = useState('');
  const [etabNom, setEtabNom]       = useState('');
  const [loading, setLoading]       = useState(true);

  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [showCfm, setShowCfm]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  const checks  = passwordChecks(password);
  const pwdOk   = checks.every(c => c.ok);
  const matchOk = password === confirm && confirm.length > 0;
  const canSubmit = pwdOk && matchOk && !submitting;

  useEffect(() => {
    let settled = false;

    async function handleSession(s: Session) {
      if (settled) return;
      settled = true;
      setSession(s);

      const [profileResult, managedResult] = await Promise.all([
        supabase.from('user_profiles')
          .select('first_name')
          .eq('id', s.user.id)
          .maybeSingle(),
        supabase.from('managed_users')
          .select('first_login_at, etablissement_id, etablissements(nom)')
          .eq('auth_user_id', s.user.id)
          .maybeSingle(),
      ]);

      setFirstName(profileResult.data?.first_name ?? '');
      setEtabNom((managedResult.data?.etablissements as { nom: string } | null)?.nom ?? '');

      // If already activated, go straight to mobile
      if (managedResult.data?.first_login_at) {
        navigate('/mobile', { replace: true });
        return;
      }
      setLoading(false);
    }

    // Listen for auth state changes (fires when Supabase processes the hash token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        handleSession(s);
      } else if (!settled) {
        // fired with null session - keep waiting until timeout
      }
    });

    // Also check for an existing session immediately
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) handleSession(s);
    });

    // Safety timeout: if no session after 10s, show invalid-link screen
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !session) return;
    setError(null);
    setSubmitting(true);

    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      setSubmitting(false);
      return;
    }

    await supabase.rpc('mark_first_login');

    setSuccess(true);
    setTimeout(() => navigate('/mobile', { replace: true }), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-slate-500 text-sm">Vérification de votre invitation…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-amber-400" />
        </div>
        <div className="text-center">
          <h1 className="text-white font-semibold text-lg">Lien invalide ou expiré</h1>
          <p className="text-slate-400 text-sm mt-1">
            Demandez un nouveau lien d'invitation à votre administrateur.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="text-center">
          <h1 className="text-white font-bold text-xl">Compte activé !</h1>
          <p className="text-slate-400 text-sm mt-1">Redirection en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,44 28,58 2,44 2,16' fill='none' stroke='rgba(59%2C130%2C246%2C0.06)' stroke-width='1'/%3E%3Cpolygon points='28,52 54,66 54,94 28,108 2,94 2,66' fill='none' stroke='rgba(59%2C130%2C246%2C0.06)' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '56px 100px',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)' }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Main Courante</span>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />

            <div className="px-8 py-8">
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-white mb-1">
                  Bienvenue{firstName ? `, ${firstName}` : ''} !
                </h1>
                {etabNom ? (
                  <p className="text-slate-400 text-sm">
                    Vous gérez désormais{' '}
                    <span className="text-slate-200 font-medium">{etabNom}</span>
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm">
                    Définissez votre mot de passe pour activer votre compte.
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <div className="mt-2.5 space-y-1">
                      {checks.map(c => (
                        <div key={c.label} className="flex items-center gap-2">
                          {c.ok
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            : <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          }
                          <span className={`text-xs ${c.ok ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showCfm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`w-full bg-slate-800 border rounded-xl px-4 py-3 pr-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                        ${confirm.length > 0 && !matchOk ? 'border-rose-500' : 'border-slate-700'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCfm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showCfm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm.length > 0 && !matchOk && (
                    <p className="mt-1 text-xs text-rose-400">Les mots de passe ne correspondent pas.</p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-sm text-rose-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                    disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed
                    text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Activation…</>
                    : 'Activer mon compte'
                  }
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Main Courante — Gestion de sécurité évènementielle
          </p>
        </div>
      </div>
    </div>
  );
}
