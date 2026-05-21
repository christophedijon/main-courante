import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ModeJauge = 'entree_sortie' | 'sortie';
type Niveau = 'vert' | 'orange' | 'rouge';

type EntrepriseJaugeConfig = {
  id: string;
  effectif_public: number;
  mode_jauge: ModeJauge;
};

export type UseJaugeReturn = {
  count: number;
  Ep: number;
  taux: number;
  niveau: Niveau;
  mode_jauge: ModeJauge;
  loading: boolean;
  entrepriseId: string | null;
  incrementJauge: (delta: number, source: 'app' | 'flic' | 'manuel') => Promise<void>;
  resetJauge: () => Promise<void>;
};

const TODAY = () => new Date().toISOString().split('T')[0];
const REALTIME_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 10_000;

export function useJauge(): UseJaugeReturn {
  const { session } = useAuth();

  const [config, setConfig] = useState<EntrepriseJaugeConfig | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const entrepriseIdRef = useRef<string | null>(null);
  const realtimeReceivedRef = useRef(false);

  const fetchCount = useCallback(async (entrepriseId: string) => {
    const { data } = await supabase
      .from('jauge_etat')
      .select('count_actuel')
      .eq('entreprise_id', entrepriseId)
      .eq('date_soiree', TODAY())
      .maybeSingle();
    if (data != null) {
      setCount(data.count_actuel);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: cfg, error: cfgError } = await supabase
        .from('entreprise')
        .select('id, effectif_public, mode_jauge')
        .limit(1)
        .maybeSingle();

      console.log('[jauge] entreprise fetch:', cfg, cfgError);

      if (cancelled) return;

      if (cfg) {
        setConfig(cfg as EntrepriseJaugeConfig);
        entrepriseIdRef.current = cfg.id;

        const { data: etat, error: etatError } = await supabase
          .from('jauge_etat')
          .select('count_actuel')
          .eq('entreprise_id', cfg.id)
          .eq('date_soiree', TODAY())
          .maybeSingle();

        console.log('[jauge] initial fetch result:', etat, etatError, '| today:', TODAY());

        if (!cancelled && etat != null) {
          setCount(etat.count_actuel);
        }
      } else {
        console.warn('[jauge] no entreprise row found');
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [fetchCount]);

  // Realtime subscription + polling fallback
  useEffect(() => {
    if (!config) return;

    const entrepriseId = config.id;
    realtimeReceivedRef.current = false;

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const channel = supabase
      .channel(`jauge-realtime-${entrepriseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jauge_etat',
          filter: `entreprise_id=eq.${entrepriseId}`,
        },
        (payload) => {
          const row = payload.new as { entreprise_id: string; date_soiree: string; count_actuel: number } | undefined;
          if (!row || row.date_soiree !== TODAY()) return;

          console.log('[jauge] Realtime update received, count:', row.count_actuel);
          realtimeReceivedRef.current = true;
          setCount(row.count_actuel);
        },
      )
      .subscribe((status) => {
        console.log('[jauge] Realtime channel status:', status);
      });

    // After timeout, start polling if realtime hasn't fired yet
    const fallbackTimeout = setTimeout(() => {
      if (!realtimeReceivedRef.current) {
        console.log('[jauge] Realtime not received — activating polling fallback every', POLL_INTERVAL_MS, 'ms');
      }
      pollInterval = setInterval(() => {
        if (!realtimeReceivedRef.current) {
          console.log('[jauge] Polling jauge_etat (realtime inactive)');
          fetchCount(entrepriseId);
        }
      }, POLL_INTERVAL_MS);
    }, REALTIME_TIMEOUT_MS);

    return () => {
      clearTimeout(fallbackTimeout);
      if (pollInterval) clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [config, fetchCount]);

  async function incrementJauge(delta: number, source: 'app' | 'flic' | 'manuel') {
    if (!config || !session?.user) return;
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
    setCount(0);
    await supabase.rpc('reset_jauge', {
      p_entreprise_id: config.id,
      p_user_id: session.user.id,
    });
  }

  const Ep = config?.effectif_public ?? 0;
  const taux = Ep > 0 ? Math.round((count / Ep) * 100) : 0;
  const niveau: Niveau = taux >= 90 ? 'rouge' : taux >= 75 ? 'orange' : 'vert';

  return {
    count,
    Ep,
    taux,
    niveau,
    mode_jauge: config?.mode_jauge ?? 'sortie',
    loading,
    entrepriseId: config?.id ?? null,
    incrementJauge,
    resetJauge,
  };
}
