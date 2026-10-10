import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { soireeDate } from '../lib/jaugeDate';

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

const POLL_INTERVAL_MS = 30_000;

type CachedConfig = EntrepriseJaugeConfig & { _ts: number };
type CachedCount = { value: number; _ts: number };

const configCache = new Map<string, CachedConfig>();
const countCache = new Map<string, CachedCount>();

export function invalidateJaugeCache() {
  configCache.clear();
  countCache.clear();
}

export function useJauge(isTest = false): UseJaugeReturn {
  const { session } = useAuth();

  const [config, setConfig] = useState<EntrepriseJaugeConfig | null>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const entrepriseIdRef = useRef<string | null>(null);

  const effectiveIsTest = config === null
    ? false
    : config.mode_jauge === 'automatique' ? false : isTest;

  const cacheKey = (id: string, tst: boolean) => `${id}:${tst}:${soireeDate()}`;

  const fetchCount = useCallback(async (entrepriseId: string) => {
    const { data } = await supabase
      .from('jauge_etat')
      .select('count_actuel')
      .eq('etablissement_id', entrepriseId)
      .eq('date_soiree', soireeDate())
      .eq('is_test', effectiveIsTest)
      .maybeSingle();
    if (data != null) {
      setCount(data.count_actuel);
      countCache.set(cacheKey(entrepriseId, effectiveIsTest), {
        value: data.count_actuel,
        _ts: Date.now(),
      });
    }
  }, [effectiveIsTest]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      let cachedId: string | null = null;

      if (config) {
        cachedId = config.id;
      } else {
        for (const [id, _] of configCache) {
          cachedId = id;
          break;
        }
      }

      const cachedCfg = cachedId ? configCache.get(cachedId) : null;
      if (cachedCfg && !cancelled) {
        setConfig(cachedCfg);
        entrepriseIdRef.current = cachedCfg.id;

        const ck = cacheKey(cachedCfg.id, cachedCfg.mode_jauge === 'automatique' ? false : isTest);
        const cachedCount = countCache.get(ck);
        if (cachedCount && !cancelled) {
          setCount(cachedCount.value);
          setLoading(false);
        }
      }

      const { data: myEntrepriseId } = await supabase.rpc('get_my_entreprise_id');
      if (cancelled) return;

      if (!myEntrepriseId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: cfg } = await supabase
        .from('etablissements')
        .select('id, effectif_public, mode_jauge, url_billetterie, frequence_billetterie')
        .eq('id', myEntrepriseId)
        .maybeSingle();

      if (cancelled) return;

      if (cfg) {
        const newCfg = cfg as EntrepriseJaugeConfig;
        setConfig(newCfg);
        entrepriseIdRef.current = newCfg.id;
        configCache.set(newCfg.id, { ...newCfg, _ts: Date.now() });

        const tst = newCfg.mode_jauge === 'automatique' ? false : isTest;
        const ck = cacheKey(newCfg.id, tst);
        const cachedCount = countCache.get(ck);
        if (cachedCount && !cancelled) {
          setCount(cachedCount.value);
          setLoading(false);
        }

        const { data: etat } = await supabase
          .from('jauge_etat')
          .select('count_actuel')
          .eq('etablissement_id', newCfg.id)
          .eq('date_soiree', soireeDate())
          .eq('is_test', tst)
          .maybeSingle();

        if (!cancelled) {
          const val = etat?.count_actuel ?? 0;
          setCount(val);
          countCache.set(ck, { value: val, _ts: Date.now() });
          setLoading(false);
        }
      } else {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [isTest]);

  useEffect(() => {
    if (!config) return;

    const entrepriseId = config.id;

    const channel = supabase
      .channel(`jauge_etat_${entrepriseId}_${effectiveIsTest ? 'test' : 'real'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jauge_etat' },
        (payload) => {
          const row = payload.new as { count_actuel?: number; etablissement_id?: string; is_test?: boolean; date_soiree?: string };
          if (row.etablissement_id !== entrepriseId) return;
          if (row.is_test !== effectiveIsTest) return;
          const currentSoiree = soireeDate();
          if (row.date_soiree !== currentSoiree) return;
          if (typeof row.count_actuel === 'number') {
            setCount(row.count_actuel);
            countCache.set(cacheKey(entrepriseId, effectiveIsTest), {
              value: row.count_actuel,
              _ts: Date.now(),
            });
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
  }, [config, fetchCount, effectiveIsTest]);

  async function incrementJauge(delta: number, source: 'app' | 'flic' | 'manuel') {
    if (!config || !session?.user) return;
    const newCount = Math.max(0, count + delta);
    setCount(newCount);
    countCache.set(cacheKey(config.id, effectiveIsTest), {
      value: newCount,
      _ts: Date.now(),
    });
    await supabase.rpc('increment_jauge', {
      p_etablissement_id: config.id,
      p_delta: delta,
      p_source: source,
      p_user_id: session.user.id,
      p_is_test: effectiveIsTest,
      p_mode_jauge: config.mode_jauge,
    });
  }

  async function resetJauge() {
    if (!config || !session?.user) return;
    setCount(0);
    countCache.set(cacheKey(config.id, effectiveIsTest), {
      value: 0,
      _ts: Date.now(),
    });
    await supabase.rpc('reset_jauge', {
      p_etablissement_id: config.id,
      p_user_id: session.user.id,
      p_is_test: effectiveIsTest,
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
