import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type EntrepriseInfo = { id: string | null; nom: string; logo_url: string | null; registre_onboarding_done: boolean; jauge_onboarding_done: boolean; rondes_onboarding_done: boolean; type_erp: string; activites_complementaires: string };

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
    .from('etablissements')
    .select('id, nom, logo_url, registre_onboarding_done, jauge_onboarding_done, rondes_onboarding_done, type_erp, activites_complementaires')
    .limit(1)
    .maybeSingle()
    .then(({ data }) => {
      fetchInFlight = false;
      if (isMegaAdmin) return;
      notify(data
        ? { id: data.id, nom: data.nom, logo_url: data.logo_url, registre_onboarding_done: data.registre_onboarding_done ?? false, jauge_onboarding_done: data.jauge_onboarding_done ?? false, rondes_onboarding_done: data.rondes_onboarding_done ?? false, type_erp: data.type_erp ?? '', activites_complementaires: data.activites_complementaires ?? '' }
        : { id: null, nom: '', logo_url: null, registre_onboarding_done: false, jauge_onboarding_done: false, rondes_onboarding_done: false, type_erp: '', activites_complementaires: '' });
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
    notify({ id: null, nom: '', logo_url: null, registre_onboarding_done: false, jauge_onboarding_done: false, rondes_onboarding_done: false, type_erp: '', activites_complementaires: '' });
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
    id: info?.id ?? null,
    nom: info?.nom ?? '',
    logo_url: info?.logo_url ?? null,
    registre_onboarding_done: info?.registre_onboarding_done ?? false,
    jauge_onboarding_done: info?.jauge_onboarding_done ?? false,
    rondes_onboarding_done: info?.rondes_onboarding_done ?? false,
    type_erp: info?.type_erp ?? '',
    activites_complementaires: info?.activites_complementaires ?? '',
    loading,
  };
}
