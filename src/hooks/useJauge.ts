import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ModeJauge = 'entree_sortie' | 'sortie' | 'automatique';
type Niveau = 'vert' | 'orange' | 'rouge';

type EntrepriseJaugeConfig = {
  id: string;
  effectif_public: number;
  mode_jauge: ModeJauge;
  url_billetterie: string;
  frequence_billetterie: number;
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
      const { data: cfg } = await supabase
        .from('entreprise')
        .select('id, effectif_public, mode_jauge, url_billetterie, frequence_billetterie')
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (cfg) {
        setConfig(cfg as EntrepriseJaugeConfig);
        entrepriseIdRef.current = cfg.id;

        const { data: etat } = await supabase
          .from('jauge_etat')
          .select('count_actuel')
          .eq('entreprise_id', cfg.id)
          .eq('date_soiree', TODAY())
          .maybeSingle();

        if (!cancelled && etat != null) {
          setCount(etat.count_actuel);
        }
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
      .channel('jauge_etat_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jauge_etat',
        },
        async () => {
          const today = new Date().toISOString().slice(0, 10);
          const { data } = await supabase
            .from('jauge_etat')
            .select('count_actuel')
            .eq('entreprise_id', entrepriseId)
            .eq('date_soiree', today)
            .maybeSingle();
          if (data !== null && data !== undefined) {
            realtimeReceivedRef.current = true;
            setCount(data.count_actuel ?? 0);
          }
        }
      )
      .subscribe();

    // After timeout, start polling if realtime hasn't fired yet
    const fallbackTimeout = setTimeout(() => {
      pollInterval = setInterval(() => {
        if (!realtimeReceivedRef.current) {
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

  // Automatic billetterie polling (mode automatique only)
  useEffect(() => {
    if (!config || config.mode_jauge !== 'automatique' || !config.url_billetterie) return;

    async function fetchBilletterie() {
      try {
        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billetterie-proxy?url=${encodeURIComponent(config!.url_billetterie!)}`;
        const res = await fetch(proxyUrl, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          }
        });
        const json = await res.json();
        if (json.resultat === 'success' && json.data) {
          const entrees = parseInt(json.data, 10);
          if (isNaN(entrees) || entrees < 0) return;
          await supabase.rpc('set_entrees_manuelles', {
            p_entreprise_id: config!.id,
            p_entrees: entrees,
            p_user_id: session?.user?.id ?? null,
          });
          console.log('[Billetterie] set_entrees_manuelles appelé avec:', entrees);
        }
      } catch (err) {
        console.warn('[Billetterie] Erreur:', err);
      }
    }

    fetchBilletterie();
    const ms = (config.frequence_billetterie ?? 10) * 60 * 1000;
    const interval = setInterval(fetchBilletterie, ms);
    return () => clearInterval(interval);
  }, [config?.mode_jauge, config?.url_billetterie, config?.frequence_billetterie]);

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
