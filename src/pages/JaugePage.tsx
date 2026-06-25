import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useJauge } from '../hooks/useJauge';

type Niveau = 'vert' | 'orange' | 'rouge';

const COLORS: Record<Niveau, { glow: string; bar: string; text: string; live: string; label: string }> = {
  vert:   { glow: 'rgba(16,185,129,0.18)',  bar: '#10b981', text: '#6ee7b7', live: '#10b981', label: 'Capacité normale' },
  orange: { glow: 'rgba(245,158,11,0.18)',  bar: '#f59e0b', text: '#fcd34d', live: '#f59e0b', label: 'Affluence élevée' },
  rouge:  { glow: 'rgba(239,68,68,0.20)',   bar: '#ef4444', text: '#fca5a5', live: '#ef4444', label: 'Capacité critique' },
};

export default function JaugePage() {
  const navigate = useNavigate();
  const { count, Ep, taux, niveau, loading } = useJauge();
  const prevCountRef = useRef(count);
  const flashRef = useRef<HTMLDivElement>(null);

  const c = COLORS[niveau];
  const pct = Math.min(taux, 100);
  const barWidth = `${pct}%`;

  // Flash animation on count change
  useEffect(() => {
    if (prevCountRef.current !== count && flashRef.current) {
      flashRef.current.animate(
        [{ opacity: 0.4 }, { opacity: 0 }],
        { duration: 600, easing: 'ease-out' }
      );
    }
    prevCountRef.current = count;
  }, [count]);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${c.glow} 0%, transparent 70%), #020617`,
      }}
    >
      {/* Flash overlay */}
      <div
        ref={flashRef}
        className="absolute inset-0 pointer-events-none opacity-0"
        style={{ background: c.glow }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex items-center gap-3">
          {/* LIVE dot */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: c.live }}
            />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Live</span>
          </div>

          <button
            onClick={() => navigate('/jauge/config')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all"
            title="Configuration"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content — vertically centered */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-10">

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: `${c.bar} transparent transparent transparent` }}
            />
            <p className="text-white/40 text-sm">Chargement…</p>
          </div>
        ) : (
          <>
            {/* Giant count */}
            <div
              className="font-black tabular-nums leading-none mb-2 transition-colors duration-700"
              style={{
                fontSize: 'clamp(96px, 22vw, 220px)',
                color: c.text,
                textShadow: `0 0 80px ${c.glow}, 0 0 30px ${c.glow}`,
              }}
            >
              {count.toLocaleString('fr-FR')}
            </div>

            {/* Label */}
            <p className="text-white/50 font-medium tracking-wide mb-1"
              style={{ fontSize: 'clamp(14px, 2.5vw, 22px)' }}>
              personnes en salle
            </p>

            {/* Capacity info */}
            {Ep > 0 && (
              <p className="text-white/25 mb-10"
                style={{ fontSize: 'clamp(12px, 1.8vw, 18px)' }}>
                Ep&nbsp;:&nbsp;{Ep.toLocaleString('fr-FR')} personnes
              </p>
            )}

            {/* Progress bar */}
            {Ep > 0 && (
              <div className="w-full max-w-lg mb-6">
                <div className="h-3 sm:h-4 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: barWidth,
                      background: `linear-gradient(90deg, ${c.bar}99, ${c.bar})`,
                      boxShadow: `0 0 12px ${c.bar}80`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Percentage + status */}
            <div className="flex items-center gap-4">
              <span
                className="font-bold tabular-nums transition-colors duration-700"
                style={{
                  fontSize: 'clamp(40px, 8vw, 80px)',
                  color: c.text,
                }}
              >
                {pct}%
              </span>
              <div
                className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border"
                style={{
                  color: c.text,
                  borderColor: `${c.bar}60`,
                  background: `${c.bar}15`,
                }}
              >
                {c.label}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom watermark */}
      <div className="relative z-10 pb-5 text-center">
        <p className="text-white/10 text-[10px] uppercase tracking-widest font-semibold">
          Jauge de capacité · Mise à jour en temps réel
        </p>
      </div>
    </div>
  );
}
