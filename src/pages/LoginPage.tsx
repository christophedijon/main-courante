import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useEntreprise } from '../hooks/useEntreprise';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { nom, logo_url } = useEntreprise();
  const isImageLogo = logo_url && logo_url.match(/\.(png|jpe?g|gif|webp)$/i);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const err = await signIn(email, password);

    if (err) {
      setLoading(false);
      setError('Email ou mot de passe incorrect.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    const [adminRes, managedRes, profileRes] = await Promise.all([
      supabase.from('super_admins').select('id').eq('email', cleanEmail).maybeSingle(),
      supabase.from('managed_users').select('fonction').eq('email', cleanEmail).maybeSingle(),
      currentSession?.user.id
        ? supabase.from('user_profiles')
            .select('first_name, last_name, telephone, nationalite')
            .eq('id', currentSession.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setLoading(false);

    const toAdmin = !!adminRes.data || managedRes.data?.fonction === 'Direction';
    if (toAdmin) {
      navigate('/dashboard');
      return;
    }

    // Mobile users: redirect to profile if any required field is missing
    const p = profileRes.data;
    const profileComplete = p &&
      p.first_name?.trim() &&
      p.last_name?.trim() &&
      p.telephone?.trim() &&
      cleanEmail &&
      p.nationalite?.trim();

    navigate(profileComplete ? '/mobile' : '/mobile/profil');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />

          <div className="p-8 sm:p-10">
            {/* Logo / Brand */}
            <div className="flex flex-col items-center mb-10">
              {isImageLogo ? (
                <img
                  src={logo_url!}
                  alt="Logo entreprise"
                  className="h-14 w-auto max-w-[160px] object-contain rounded-xl mb-4"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
              )}
              <h1 className="text-2xl font-semibold text-white tracking-tight">Main Courante</h1>
              {nom && <p className="text-sm text-slate-400 mt-1">{nom}</p>}
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-sm text-red-400 animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemple.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
                  text-white font-medium rounded-xl py-3 px-4 text-sm
                  transition-all duration-200 mt-2
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Connexion en cours…
                  </span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 sm:px-10 py-4 bg-slate-950/50 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center">
              Accès réservé aux administrateurs autorisés
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
