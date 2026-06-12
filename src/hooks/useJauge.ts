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
const POLL_INTERVAL_MS = 30_000;

export function useJauge(isTest = false): UseJaugeReturn {
  const { session } = useAuth();

  const [config, setConfig] = useState<EntrepriseJaugeConfig | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const entrepriseIdRef = useRef<string | null>(null);
  const lastZapsisCountRef = useRef<number | null>(null);

  const fetchCount = useCallback(async (entrepriseId: string) => {
    const { data } = await supabase
      .from('jauge_etat')
      .select('count_actuel')
      .eq('entreprise_id', entrepriseId)
      .eq('date_soiree', TODAY())
      .eq('is_test', isTest)
      .maybeSingle();
    if (data != null) {
      setCount(data.count_actuel);
    } else {
      setCount(0);
    }
  }, [isTest]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: cfg } = await supabase
        .from('entreprise')
        .select('id, effectif_public, mode_jauge, url_billetterie, frequence_billetterie')
        .order('enseigne', { ascending: true, nullsFirst: false })
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
          .eq('is_test', isTest)
          .maybeSingle();

        if (!cancelled) {
          setCount(etat?.count_actuel ?? 0);
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [fetchCount, isTest]);

  // Realtime subscription + continuous polling (mobile-reliable)
  useEffect(() => {
    if (!config) return;

    const entrepriseId = config.id;

    const channel = supabase
      .channel(`jauge_etat_${entrepriseId}_${isTest ? 'test' : 'real'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jauge_etat' },
        (payload) => {
          const row = payload.new as { count_actuel?: number; entreprise_id?: string; is_test?: boolean };
          if (row.entreprise_id !== entrepriseId) return;
          if (row.is_test !== isTest) return;
          if (typeof row.count_actuel === 'number') {
            setCount(row.count_actuel);
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(() => fetchCount(entrepriseId), POLL_INTERVAL_MS);

    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchCount(entrepriseId);
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [config, fetchCount, isTest]);

  // Automatic billetterie polling (mode automatique only, never in test mode)
  useEffect(() => {
    if (!config || config.mode_jauge !== 'automatique' || !config.url_billetterie || isTest) return;

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
        if (json.resultat !== 'success' || !json.data) return;
        const entrees = parseInt(json.data, 10);
        if (isNaN(entrees) || entrees < 0) return;
        const today = new Date().toISOString().slice(0, 10);
        if (lastZapsisCountRef.current === null) {
          lastZapsisCountRef.current = entrees;
          await supabase.rpc('set_entrees_manuelles', {
            p_entreprise_id: config!.id,
            p_entrees: entrees,
            p_user_id: null,
            p_is_test: false,
          });
          await supabase
            .from('jauge_etat')
            .update({ entrees_max_zapsis: entrees })
            .eq('entreprise_id', config!.id)
            .eq('date_soiree', today)
            .eq('is_test', false)
            .lt('entrees_max_zapsis', entrees);
          return;
        }
        const diff = entrees - lastZapsisCountRef.current;
        if (diff > 0) {
          await supabase.rpc('increment_jauge', {
            p_entreprise_id: config!.id,
            p_delta: diff,
            p_source: 'app',
            p_user_id: session?.user?.id ?? null,
            p_is_test: false,
          });
        }
        await supabase
          .from('jauge_etat')
          .update({ entrees_max_zapsis: entrees })
          .eq('entreprise_id', config!.id)
          .eq('date_soiree', today)
          .eq('is_test', false)
          .lt('entrees_max_zapsis', entrees);
        lastZapsisCountRef.current = entrees;
      } catch (err) {
        console.warn('[Billetterie] Erreur:', err);
      }
    }

    fetchBilletterie();
    const ms = (config.frequence_billetterie ?? 10) * 60 * 1000;
    const interval = setInterval(fetchBilletterie, ms);
    return () => {
      clearInterval(interval);
      lastZapsisCountRef.current = null;
    };
  }, [config?.mode_jauge, config?.url_billetterie, config?.frequence_billetterie, session?.user?.id, isTest]);

  async function incrementJauge(delta: number, source: 'app' | 'flic' | 'manuel') {
    if (!config || !session?.user) return;
    setCount(prev => Math.max(0, prev + delta));
    await supabase.rpc('increment_jauge', {
      p_entreprise_id: config.id,
      p_delta: delta,
      p_source: source,
      p_user_id: session.user.id,
      p_is_test: isTest,
    });
  }

  async function resetJauge() {
    if (!config || !session?.user) return;
    setCount(0);
    await supabase.rpc('reset_jauge', {
      p_entreprise_id: config.id,
      p_user_id: session.user.id,
      p_is_test: isTest,
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
