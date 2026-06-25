import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Niveau = 'vert' | 'orange' | 'rouge';

const COLORS: Record<Niveau, { glow: string; bar: string; text: string; live: string; label: string }> = {
  vert:   { glow: 'rgba(16,185,129,0.18)',  bar: '#10b981', text: '#6ee7b7', live: '#10b981', label: 'Capacité normale' },
  orange: { glow: 'rgba(245,158,11,0.18)',  bar: '#f59e0b', text: '#fcd34d', live: '#f59e0b', label: 'Affluence élevée' },
  rouge:  { glow: 'rgba(239,68,68,0.20)',   bar: '#ef4444', text: '#fca5a5', live: '#ef4444', label: 'Capacité critique' },
};

function getNiveau(taux: number): Niveau {
  if (taux >= 90) return 'rouge';
  if (taux >= 75) return 'orange';
  return 'vert';
}

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function PublicJaugePage() {
  const { etablissementId } = useParams<{ etablissementId: string }>();

  const [entrepriseId, setEntrepriseId] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [ep, setEp] = useState(0);
  const [enseigne, setEnseigne] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevCountRef = useRef(count);
  const flashRef = useRef<HTMLDivElement>(null);

  // Initial load: find entreprise via etablissement_id, then fetch jauge state
  useEffect(() => {
    if (!etablissementId) {
      setError('Identifiant établissement manquant.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data: ent, error: entErr } = await supabase
        .from('entreprise')
        .select('id, effectif_public_maximum, enseigne')
        .eq('etablissement_id', etablissementId)
        .maybeSingle();

      if (cancelled) return;

      if (entErr || !ent) {
        setError('Établissement introuvable ou accès refusé.');
        setLoading(false);
        return;
      }

      const { data: etat } = await supabase
        .from('jauge_etat')
        .select('count_actuel')
        .eq('entreprise_id', ent.id)
        .eq('date_soiree', today())
        .eq('is_test', false)
        .maybeSingle();

      if (cancelled) return;

      setEntrepriseId(ent.id);
      setEp(ent.effectif_public_maximum ?? 0);
      setEnseigne(ent.enseigne ?? '');
      setCount(etat?.count_actuel ?? 0);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [etablissementId]);

  // Polling every 3 seconds
  useEffect(() => {
    if (!entrepriseId || loading || error) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('jauge_etat')
        .select('count_actuel')
        .eq('entreprise_id', entrepriseId)
        .eq('date_soiree', today())
        .eq('is_test', false)
        .maybeSingle();
      if (data != null) setCount(data.count_actuel);
    }, 3000);

    return () => clearInterval(interval);
  }, [entrepriseId, loading, error]);

  // Realtime subscription
  useEffect(() => {
    if (!entrepriseId || loading || error) return;

    const channel = supabase
      .channel(`public_jauge_${entrepriseId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jauge_etat' },
        (payload) => {
          const row = payload.new as { count_actuel?: number; entreprise_id?: string; is_test?: boolean };
          if (row.entreprise_id !== entrepriseId) return;
          if (row.is_test) return;
          if (typeof row.count_actuel === 'number') setCount(row.count_actuel);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [entrepriseId, loading, error]);

  // Flash on count change
  useEffect(() => {
    if (prevCountRef.current !== count && flashRef.current) {
      flashRef.current.animate(
        [{ opacity: 0.35 }, { opacity: 0 }],
        { duration: 600, easing: 'ease-out' }
      );
    }
    prevCountRef.current = count;
  }, [count]);

  const taux = ep > 0 ? Math.min(Math.round((count / ep) * 100), 100) : 0;
  const niveau = getNiveau(taux);
  const c = COLORS[niveau];

  if (!loading && error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950">
        <div className="text-center px-8">
          <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <span className="text-red-400 text-2xl">!</span>
          </div>
          <p className="text-white/60 text-lg mb-2">Capacité non disponible</p>
          <p className="text-white/30 text-sm">{error}</p>
        </div>
      </div>
    );
  }

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
        <p className="text-white/30 text-sm font-medium truncate max-w-[60%]">
          {enseigne || '\u00A0'}
        </p>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: c.live }}
          />
          <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-10">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-full border-4 animate-spin"
              style={{ borderColor: `${c.bar} transparent transparent transparent` }}
            />
            <p className="text-white/40 text-sm">Chargement…</p>
          </div>
        ) : (
          <>
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

            <p
              className="text-white/50 font-medium tracking-wide mb-1"
              style={{ fontSize: 'clamp(14px, 2.5vw, 22px)' }}
            >
              personnes en salle
            </p>

            {ep > 0 && (
              <p
                className="text-white/25 mb-10"
                style={{ fontSize: 'clamp(12px, 1.8vw, 18px)' }}
              >
                Ep max&nbsp;:&nbsp;{ep.toLocaleString('fr-FR')} personnes
              </p>
            )}

            {ep > 0 && (
              <div className="w-full max-w-lg mb-6">
                <div className="h-3 sm:h-4 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${taux}%`,
                      background: `linear-gradient(90deg, ${c.bar}99, ${c.bar})`,
                      boxShadow: `0 0 12px ${c.bar}80`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <span
                className="font-bold tabular-nums transition-colors duration-700"
                style={{
                  fontSize: 'clamp(40px, 8vw, 80px)',
                  color: c.text,
                }}
              >
                {taux}%
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

      <div className="relative z-10 pb-5 text-center">
        <p className="text-white/10 text-[10px] uppercase tracking-widest font-semibold">
          Jauge de capacité · Mise à jour en temps réel
        </p>
      </div>
    </div>
  );
}
