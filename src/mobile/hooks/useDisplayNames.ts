import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type DisplayNameMap = Record<string, { display_name: string; fonction: string }>;

export function useDisplayNames(authIds: string[]) {
  const { userMetaReady } = useAuth();
  const [nameMap, setNameMap] = useState<DisplayNameMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userMetaReady || authIds.length === 0) {
      setNameMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_display_names', {
        p_auth_ids: authIds,
      });
      if (cancelled) return;
      if (error || !data) {
        setNameMap({});
        setLoading(false);
        return;
      }
      const map: DisplayNameMap = {};
      for (const row of data as { auth_user_id: string; display_name: string; fonction: string }[]) {
        map[row.auth_user_id] = { display_name: row.display_name, fonction: row.fonction };
      }
      setNameMap(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authIds.join(','), userMetaReady]);

  return { nameMap, loading };
}

export function resolveDisplayName(
  nameMap: DisplayNameMap,
  authId: string | null | undefined,
  fallback: string
): string {
  if (!authId) return fallback;
  const entry = nameMap[authId];
  return entry?.display_name || fallback;
}

export function resolveDisplayFonction(
  nameMap: DisplayNameMap,
  authId: string | null | undefined,
  fallback: string
): string {
  if (!authId) return fallback;
  const entry = nameMap[authId];
  return entry?.fonction || fallback;
}
