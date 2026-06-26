import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useJauge } from '../hooks/useJauge';

type Niveau = 'vert' | 'orange' | 'rouge';

const THEME: Record<Niveau, {
  bg: string;
  accent: string;
  accentSoft: string;
  bar: string;
  barBg: string;
  badge: string;
  badgeText: string;
  label: string;
}> = {
  vert: {
    bg:        'radial-gradient(ellipse 90% 55% at 50% 35%, rgba(16,185,129,0.14) 0%, transparent 70%), #020617',
    accent:    '#34d399',
    accentSoft:'rgba(52,211,153,0.18)',
    bar:       'linear-gradient(90deg, #059669, #34d399)',
    barBg:     'rgba(52,211,153,0.12)',
    badge:     'rgba(16,185,129,0.15)',
    badgeText: '#6ee7b7',
    label:     'Accès ouvert',
  },
  orange: {
    bg:        'radial-gradient(ellipse 90% 55% at 50% 35%, rgba(245,158,11,0.14) 0%, transparent 70%), #020617',
    accent:    '#fbbf24',
    accentSoft:'rgba(251,191,36,0.18)',
    bar:       'linear-gradient(90deg, #d97706, #fbbf24)',
    barBg:     'rgba(251,191,36,0.12)',
    badge:     'rgba(245,158,11,0.15)',
    badgeText: '#fcd34d',
    label:     'Affluence élevée',
  },
  rouge: {
    bg:        'radial-gradient(ellipse 90% 55% at 50% 35%, rgba(239,68,68,0.16) 0%, transparent 70%), #020617',
    accent:    '#f87171',
    accentSoft:'rgba(248,113,113,0.18)',
    bar:       'linear-gradient(90deg, #dc2626, #f87171)',
    barBg:     'rgba(248,113,113,0.12)',
    badge:     'rgba(239,68,68,0.15)',
    badgeText: '#fca5a5',
    label:     'Quasi complet',
  },
};

function getNiveau(taux: number): Niveau {
  if (taux > 80) return 'rouge';
  if (taux >= 50) return 'orange';
  return 'vert';
}

export default function JaugePage() {
  const navigate = useNavigate();
  const { count, Ep, loading, entrepriseId } = useJauge();
  const prevCountRef = useRef(count);

  useEffect(() => { prevCountRef.current = count; }, [count]);

  const taux   = Ep > 0 ? Math.min(Math.round((count / Ep) * 100), 100) : 0;
  const reste  = Math.max(Ep - count, 0);
  const niveau = getNiveau(taux);
  const t      = THEME[niveau];

  // No entreprise attached to this user
  if (!loading && entrepriseId === null) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden select-none bg-slate-950">
        <div className="relative z-10 flex items-center px-6 pt-6 pb-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Retour</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border"
            style={{ background: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.2)' }}
          >
            <Settings className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-white/50 text-lg font-semibold mb-2">Aucun établissement</p>
          <p className="text-white/25 text-sm">
            Cette fonction est rattachée à un établissement.
            Connectez-vous avec un compte opérationnel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: t.bg, transition: 'background 1.2s ease' }}
    >
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Retour</span>
        </button>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: t.accent }}
            />
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Live</span>
          </div>

          <button
            onClick={() => navigate('/jauge/config')}
            className="p-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            title="Configuration"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {loading ? (
          <div className="flex flex-col items-center gap-5">
            <div
              className="w-14 h-14 rounded-full border-4 animate-spin"
              style={{ borderColor: `${t.accent} transparent transparent transparent` }}
            />
            <p className="text-white/30 text-sm tracking-wide">Chargement…</p>
          </div>
        ) : (
          <div className="w-full max-w-5xl flex flex-col items-center gap-0 px-4">

            {/* Eyebrow */}
            <p
              className="font-semibold tracking-widest uppercase mb-8"
              style={{ fontSize: 'clamp(20px, 4vw, 48px)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.22em' }}
            >
              Vous êtes actuellement
            </p>

            {/* Big counter */}
            <div
              className="font-black tabular-nums leading-none mb-10 transition-all duration-700 text-center"
              style={{
                fontSize: 'clamp(100px, 22vw, 240px)',
                color: t.accent,
                textShadow: `0 0 80px ${t.accentSoft}, 0 0 160px ${t.accentSoft}`,
              }}
            >
              {count.toLocaleString('fr-FR')}
              <span
                className="font-light"
                style={{ fontSize: 'clamp(50px, 11vw, 120px)', color: 'rgba(255,255,255,0.2)', margin: '0 0.12em' }}
              >
                /
              </span>
              <span
                className="font-semibold"
                style={{ fontSize: 'clamp(60px, 13vw, 140px)', color: 'rgba(255,255,255,0.45)' }}
              >
                {Ep.toLocaleString('fr-FR')}
              </span>
            </div>

            {/* Subtitle */}
            <p
              className="font-bold mb-12 text-center transition-colors duration-700"
              style={{
                fontSize: 'clamp(22px, 4.5vw, 52px)',
                color: Ep > 0
                  ? (reste === 0 ? THEME.rouge.badgeText : t.badgeText)
                  : 'rgba(255,255,255,0.3)',
              }}
            >
              {Ep > 0
                ? reste === 0
                  ? 'Aucune place disponible'
                  : `Encore ${reste.toLocaleString('fr-FR')} place${reste > 1 ? 's' : ''} disponible${reste > 1 ? 's' : ''}`
                : 'Capacité non configurée'}
            </p>

            {/* Progress bar */}
            {Ep > 0 && (
              <div className="w-full mb-10">
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{
                    height: 'clamp(16px, 2.5vw, 32px)',
                    background: t.barBg,
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${taux}%`,
                      background: t.bar,
                      boxShadow: `0 0 24px ${t.accentSoft}`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-4">
                  <span style={{ fontSize: 'clamp(14px, 2vw, 28px)', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>0</span>
                  <span
                    className="font-black tabular-nums transition-colors duration-700"
                    style={{ fontSize: 'clamp(20px, 3.5vw, 44px)', color: t.accent }}
                  >
                    {taux}%
                  </span>
                  <span style={{ fontSize: 'clamp(14px, 2vw, 28px)', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>{Ep.toLocaleString('fr-FR')}</span>
                </div>
              </div>
            )}

            {/* Status badge */}
            <div
              className="font-bold uppercase tracking-widest border transition-all duration-700 rounded-full"
              style={{
                fontSize: 'clamp(14px, 2vw, 26px)',
                padding: 'clamp(8px, 1.2vw, 16px) clamp(20px, 3vw, 48px)',
                color: t.badgeText,
                background: t.badge,
                borderColor: `${t.accent}40`,
                letterSpacing: '0.2em',
              }}
            >
              {t.label}
            </div>

          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-6 text-center">
        <p className="text-white/10 text-[9px] uppercase tracking-widest font-semibold">
          Jauge de capacité · Mise à jour en temps réel
        </p>
      </div>
    </div>
  );
}
