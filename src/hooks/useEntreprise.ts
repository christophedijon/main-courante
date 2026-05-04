import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type EntrepriseInfo = { nom: string; logo_url: string | null };

let cache: EntrepriseInfo | null = null;
const listeners: Array<(v: EntrepriseInfo) => void> = [];

function notify(v: EntrepriseInfo) {
  cache = v;
  listeners.forEach((fn) => fn(v));
}

export function invalidateEntrepriseCache() {
  cache = null;
}

export function useEntreprise() {
  const [info, setInfo] = useState<EntrepriseInfo>(cache ?? { nom: '', logo_url: null });

  useEffect(() => {
    listeners.push(setInfo);
    if (!cache) {
      supabase.from('entreprise').select('nom, logo_url').limit(1).maybeSingle().then(({ data }) => {
        notify(data ? { nom: data.nom, logo_url: data.logo_url } : { nom: '', logo_url: null });
      });
    }
    return () => {
      const idx = listeners.indexOf(setInfo);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  return info;
}
