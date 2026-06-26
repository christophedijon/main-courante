import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type EntrepriseInfo = { nom: string; logo_url: string | null };

let cache: EntrepriseInfo | null = null;
let isMegaAdmin = false;
const listeners: Array<(v: EntrepriseInfo) => void> = [];
let fetchInFlight = false;

function notify(v: EntrepriseInfo) {
  cache = v;
  listeners.forEach((fn) => fn(v));
}

function doFetch() {
  if (fetchInFlight || isMegaAdmin) return;
  fetchInFlight = true;
  supabase
    .from('entreprise')
    .select('nom, logo_url')
    .limit(1)
    .maybeSingle()
    .then(({ data }) => {
      fetchInFlight = false;
      if (isMegaAdmin) return;
      notify(data ? { nom: data.nom, logo_url: data.logo_url } : { nom: '', logo_url: null });
    })
    .catch(() => { fetchInFlight = false; });
}

// Called by AuthContext on every auth state change to clear stale cache.
export function invalidateEntrepriseCache() {
  cache = null;
  fetchInFlight = false;
}

// Called by AuthContext after loadUserMeta resolves.
// v=true  → mega admin, no company; suppress all fetches and show empty.
// v=false → normal user; trigger a fresh fetch for listeners already mounted.
export function setEntrepriseMegaAdmin(v: boolean) {
  isMegaAdmin = v;
  cache = null;
  fetchInFlight = false;
  if (v) {
    notify({ nom: '', logo_url: null });
  } else if (listeners.length > 0) {
    doFetch();
  }
}

export function useEntreprise() {
  const [info, setInfo] = useState<EntrepriseInfo | null>(cache);
  const [loading, setLoading] = useState(!cache && !isMegaAdmin);

  useEffect(() => {
    if (cache) {
      setInfo(cache);
      setLoading(false);
    } else if (isMegaAdmin) {
      setLoading(false);
    }

    const handler = (v: EntrepriseInfo) => {
      setInfo(v);
      setLoading(false);
    };
    listeners.push(handler);

    if (!cache && !isMegaAdmin) {
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
