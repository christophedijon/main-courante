import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type EntrepriseInfo = { nom: string; logo_url: string | null };

let cache: EntrepriseInfo | null = null;
const listeners: Array<(v: EntrepriseInfo) => void> = [];
let fetchInFlight = false;

function notify(v: EntrepriseInfo) {
  cache = v;
  listeners.forEach((fn) => fn(v));
}

function doFetch() {
  if (fetchInFlight) return;
  fetchInFlight = true;
  supabase
    .from('entreprise')
    .select('nom, logo_url')
    .limit(1)
    .maybeSingle()
    .then(({ data }) => {
      fetchInFlight = false;
      notify(data ? { nom: data.nom, logo_url: data.logo_url } : { nom: '', logo_url: null });
    })
    .catch(() => { fetchInFlight = false; });
}

export function invalidateEntrepriseCache() {
  cache = null;
  if (listeners.length > 0) {
    doFetch();
  }
}

export function useEntreprise() {
  const [info, setInfo] = useState<EntrepriseInfo | null>(cache);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache) {
      setInfo(cache);
      setLoading(false);
    }

    const handler = (v: EntrepriseInfo) => {
      setInfo(v);
      setLoading(false);
    };

    listeners.push(handler);

    if (!cache) {
      doFetch();
    }

    return () => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    nom: info?.nom ?? '',
    logo_url: info?.logo_url ?? null,
    loading,
  };
}
