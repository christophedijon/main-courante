import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export type Plan = 'testeur' | 'light' | 'base' | 'premium';

const FEATURE_MATRIX: Record<string, Plan[]> = {
  // Toutes les offres
  registre_signatures:   ['testeur', 'light', 'base', 'premium'],
  historique_evenements: ['testeur', 'light', 'base', 'premium'],
  jauge_manuel:          ['testeur', 'light', 'base', 'premium'],
  postes_assignations:   ['testeur', 'light', 'base', 'premium'],
  // Base et au-dessus
  flic_hub:              ['testeur', 'base', 'premium'],
  email_rapports:        ['testeur', 'base', 'premium'],
  rondes:                ['testeur', 'base', 'premium'],
  // Premium uniquement
  zapsis_auto:           ['testeur', 'premium'],
  ble_rondes:            ['testeur', 'premium'],
  ia_assistant:          ['testeur', 'premium'],
  jauge_auto:            ['testeur', 'premium'],
};

const AGENT_LIMITS: Record<Plan, number> = {
  testeur: Infinity,
  light:   5,
  base:    Infinity,
  premium: Infinity,
};

export function usePlan() {
  const { session, isSuperAdmin } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    // Les admins plateforme (super_admins table) ont accès complet
    if (isSuperAdmin) {
      setPlan('testeur');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const { data: mu } = await supabase
        .from('managed_users')
        .select('etablissement_id')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (!mu?.etablissement_id) {
        setPlan('light');
        setLoading(false);
        return;
      }

      const { data: etab } = await supabase
        .from('etablissements')
        .select('plan')
        .eq('id', mu.etablissement_id)
        .maybeSingle();

      setPlan((etab?.plan as Plan) ?? 'light');
      setLoading(false);
    })();
  }, [userId, isSuperAdmin]);

  function hasFeature(feature: string): boolean {
    if (!plan) return false;
    const allowed = FEATURE_MATRIX[feature];
    if (!allowed) return true;
    return allowed.includes(plan);
  }

  function agentLimit(): number {
    return plan ? AGENT_LIMITS[plan] : 5;
  }

  return { plan, loading, hasFeature, agentLimit };
}
