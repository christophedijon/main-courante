import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const LOCK_KEY = 'editor_lock_until';
const ATTEMPTS_KEY = 'editor_attempts';
const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000;

export default function EditorAccessPage() {
  const navigate = useNavigate();

  // Step A state
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockRemaining, setLockRemaining] = useState(0);

  // Step B state
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);

  // Init lock state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(LOCK_KEY);
    const storedAttempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) ?? '0', 10);
    setAttempts(storedAttempts);
    if (stored) {
      const until = parseInt(stored, 10);
      if (Date.now() < until) {
        setLockUntil(until);
      } else {
        localStorage.removeItem(LOCK_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
      }
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockUntil(null);
        setAttempts(0);
        localStorage.removeItem(LOCK_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
        setLockRemaining(0);
      } else {
        setLockRemaining(remaining);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lockUntil) return;

    const correct = password === import.meta.env.VITE_EDITOR_PASSWORD;

    if (correct) {
      setPasswordError('');
      setAttempts(0);
      localStorage.removeItem(LOCK_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem(ATTEMPTS_KEY, String(newAttempts));

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCK_DURATION_MS;
        setLockUntil(until);
        localStorage.setItem(LOCK_KEY, String(until));
        setPasswordError('');
      } else {
        setPasswordError('Mot de passe incorrect');
      }
      setPassword('');
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setCodeError('');

    const { data, error } = await supabase
      .from('editor_sessions')
      .select('*, entreprise(*)')
      .eq('code', code.trim())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      setCodeError('Code invalide ou révoqué');
      setLoading(false);
      return;
    }

    await supabase
      .from('editor_sessions')
      .update({ connected_at: new Date().toISOString() })
      .eq('id', data.id);

    const ent = data.entreprise as { id: string; nom: string } | null;
    sessionStorage.setItem('editor_session', JSON.stringify({
      entrepriseId: ent?.id ?? data.entreprise_id,
      entrepriseNom: ent?.nom ?? '',
      editorMode: true,
    }));

    const { error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError) console.error('Anon auth error:', anonError);

    navigate('/editor/backoffice');
  }

  const isLocked = !!lockUntil;
  const lockMinutes = Math.floor(lockRemaining / 60);
  const lockSeconds = lockRemaining % 60;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Amber top bar */}
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-400" />

          <div className="px-8 py-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-amber-400" />
              </div>
              <h1 className="text-white font-bold text-xl leading-tight">
                Main Courante — Accès support
              </h1>
              <p className="text-slate-500 text-sm mt-1.5">
                Réservé à l'équipe SARL Gréco
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-7">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                step === 'password' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {step === 'code' ? '✓' : '1'}
              </div>
              <div className={`flex-1 h-px transition-colors ${step === 'code' ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                step === 'code' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-500'
              }`}>
                2
              </div>
            </div>

            {/* ── STEP A — Editor password ── */}
            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Mot de passe éditeur
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                      disabled={isLocked}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className={`w-full bg-slate-800 border rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-600 text-sm
                        focus:outline-none focus:ring-2 focus:border-transparent transition-all
                        ${isLocked ? 'opacity-50 cursor-not-allowed border-slate-700' : passwordError ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-amber-500'}`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Errors / lock message */}
                {isLocked ? (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-400">
                      Accès bloqué pendant{' '}
                      <span className="font-mono font-bold">
                        {lockMinutes}:{String(lockSeconds).padStart(2, '0')}
                      </span>
                    </p>
                  </div>
                ) : passwordError ? (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-400">{passwordError}</p>
                  </div>
                ) : null}

                {!isLocked && attempts > 0 && attempts < MAX_ATTEMPTS && !passwordError && (
                  <p className="text-xs text-slate-500 text-center">
                    {MAX_ATTEMPTS - attempts} tentative{MAX_ATTEMPTS - attempts > 1 ? 's' : ''} restante{MAX_ATTEMPTS - attempts > 1 ? 's' : ''}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLocked || !password}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400
                    disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
                    text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-amber-900/20"
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* ── STEP B — Client code ── */}
            {step === 'code' && (
              <form onSubmit={handleCodeSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-4 uppercase tracking-wider text-center">
                    Code d'accès client
                  </label>
                  <input
                    ref={codeRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCode(val);
                      setCodeError('');
                    }}
                    placeholder="0000"
                    className={`w-full bg-slate-800 border rounded-xl py-4 text-center text-amber-400 placeholder-slate-600
                      focus:outline-none focus:ring-2 focus:border-transparent transition-all
                      ${codeError ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-amber-500'}
                      font-mono font-bold`}
                    style={{ fontSize: '36px', letterSpacing: '0.3em' }}
                  />
                </div>

                {codeError && (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-400">{codeError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={code.length !== 4 || loading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400
                    disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
                    text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-amber-900/20"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Vérification…
                    </>
                  ) : (
                    <>
                      Accéder
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-5">
          Main Courante · Accès réservé
        </p>
      </div>
    </div>
  );
}
