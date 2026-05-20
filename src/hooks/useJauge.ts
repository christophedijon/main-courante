import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ModeJauge = 'entree_sortie' | 'sortie';
type Niveau = 'vert' | 'orange' | 'rouge';

type EntrepriseJaugeConfig = {
  id: string;
  effectif_public_maximum: number;
  mode_jauge: ModeJauge;
};

export type UseJaugeReturn = {
  count: number;
  Ep: number;
  taux: number;
  niveau: Niveau;
  mode_jauge: ModeJauge;
  loading: boolean;
  incrementJauge: (delta: number, source: 'app' | 'flic' | 'manuel') => Promise<void>;
  resetJauge: () => Promise<void>;
};

const TODAY = () => new Date().toISOString().split('T')[0];

export function useJauge(): UseJaugeReturn {
  const { session } = useAuth();

  const [config, setConfig] = useState<EntrepriseJaugeConfig | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Keep a stable ref to entreprise_id for use in realtime callback
  const entrepriseIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [configRes, etatRes] = await Promise.all([
        supabase
          .from('entreprise')
          .select('id, effectif_public_maximum, mode_jauge')
          .limit(1)
          .maybeSingle(),
        // We'll set count after we know the entreprise_id; fetch all for today
        // and filter after we get the id, or do it in one step below
      ]);

      if (cancelled) return;

      const cfg = configRes.data as EntrepriseJaugeConfig | null;
      if (cfg) {
        setConfig(cfg);
        entrepriseIdRef.current = cfg.id;

        const { data: etat } = await supabase
          .from('jauge_etat')
          .select('count_actuel, updated_at')
          .eq('entreprise_id', cfg.id)
          .eq('date_soiree', TODAY())
          .maybeSingle();

        if (!cancelled) {
          setCount(etat?.count_actuel ?? 0);
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('jauge-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jauge_etat' },
        (payload) => {
          const row = payload.new as { entreprise_id: string; date_soiree: string; count_actuel: number };
          if (
            row.entreprise_id === entrepriseIdRef.current &&
            row.date_soiree === TODAY()
          ) {
            setCount(row.count_actuel);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function incrementJauge(delta: number, source: 'app' | 'flic' | 'manuel') {
    if (!config || !session?.user) return;
    // Optimistic update
    setCount(prev => Math.max(0, prev + delta));
    await supabase.rpc('increment_jauge', {
      p_entreprise_id: config.id,
      p_delta: delta,
      p_source: source,
      p_user_id: session.user.id,
    });
  }

  async function resetJauge() {
    if (!config || !session?.user) return;
    // Optimistic update
    setCount(0);
    await supabase.rpc('reset_jauge', {
      p_entreprise_id: config.id,
      p_user_id: session.user.id,
    });
  }

  const Ep = config?.effectif_public_maximum ?? 0;
  const taux = Ep > 0 ? Math.round((count / Ep) * 100) : 0;
  const niveau: Niveau = taux >= 90 ? 'rouge' : taux >= 75 ? 'orange' : 'vert';

  return {
    count,
    Ep,
    taux,
    niveau,
    mode_jauge: config?.mode_jauge ?? 'sortie',
    loading,
    incrementJauge,
    resetJauge,
  };
}
