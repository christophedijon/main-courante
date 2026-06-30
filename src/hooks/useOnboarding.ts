import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type OnboardingData, INITIAL_DATA } from '../pages/onboarding/types';

// Numeric etape → text step name written to onboarding_step column
const ETAPE_STEP_MAP: Record<number, string> = {
  0: 'welcome',
  1: 'entreprise',
  2: 'espaces',
  3: 'motifs',
  4: 'activation',
};

// Text step name → numeric etape (used when loading from DB)
const STEP_ETAPE_MAP: Record<string, number> = {
  welcome:    0,
  entreprise: 1,
  espaces:    2,
  motifs:     3,
  activation: 4,
  // legacy step names — map to closest new equivalent
  coordonnees:   1,
  categorie_erp: 1,
  direction:     1,
  materiel:      3,
  logo:          3,
  recap:         4,
};

export interface OnboardingState {
  etabId: string | null;
  etape: number;
  data: OnboardingData;
  saving: boolean;
  error: string | null;
  activated: boolean;
}

export function useOnboarding(existingEtabId?: string) {
  const [state, setState] = useState<OnboardingState>({
    etabId: existingEtabId ?? null,
    etape: 0,
    data: { ...INITIAL_DATA },
    saving: false,
    error: null,
    activated: false,
  });

  // Load existing draft when existingEtabId is provided
  useEffect(() => {
    if (!existingEtabId) return;
    (async () => {
      setState(s => ({ ...s, saving: true }));
      const { data: etab } = await supabase
        .from('etablissements')
        .select('nom, onboarding_data, onboarding_etape, onboarding_step')
        .eq('id', existingEtabId)
        .maybeSingle();
      if (etab) {
        const resolvedEtape = etab.onboarding_step
          ? (STEP_ETAPE_MAP[etab.onboarding_step] ?? etab.onboarding_etape ?? 0)
          : (etab.onboarding_etape ?? 0);
        const loadedData = { ...INITIAL_DATA, ...(etab.onboarding_data as Partial<OnboardingData> ?? {}) };
        if (!loadedData.nom && etab.nom) loadedData.nom = etab.nom;
        setState(s => ({
          ...s,
          saving: false,
          data: loadedData,
          etape: resolvedEtape,
        }));
      } else {
        setState(s => ({ ...s, saving: false }));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingEtabId]);

  const setError = (error: string | null) =>
    setState(s => ({ ...s, error }));

  const updateData = useCallback((patch: Partial<OnboardingData>) => {
    setState(s => ({ ...s, data: { ...s.data, ...patch } }));
  }, []);

  async function initEtab(): Promise<string | null> {
    setState(s => ({ ...s, saving: true, error: null }));
    const { data, error } = await supabase.rpc('creer_client_brouillon');
    if (error || !data) {
      console.error('[initEtab] Supabase error:', error);
      setState(s => ({ ...s, saving: false, error: `Impossible de créer le brouillon. (${error?.code}: ${error?.message})` }));
      return null;
    }
    setState(s => ({ ...s, etabId: data as string, saving: false }));
    return data as string;
  }

  // Advance to the given next etape and persist
  async function saveStep(etabId: string, _currentEtape: number, patch: Partial<OnboardingData>, nextEtape?: number): Promise<boolean> {
    setState(s => ({ ...s, saving: true, error: null }));
    const newData = { ...state.data, ...patch };
    const actualNext = nextEtape ?? (_currentEtape + 1);

    const { data: updated, error } = await supabase
      .from('etablissements')
      .update({
        onboarding_data: newData,
        onboarding_etape: actualNext,
        onboarding_step: ETAPE_STEP_MAP[actualNext] ?? 'entreprise',
      })
      .eq('id', etabId)
      .select('id');

    if (error) {
      console.error('[saveStep] Supabase error:', error);
      setState(s => ({ ...s, saving: false, error: `Erreur lors de la sauvegarde. (${error.code}: ${error.message})` }));
      return false;
    }
    if (!updated || updated.length === 0) {
      console.error('[saveStep] 0 rows affected — RLS or wrong etabId?', etabId);
      setState(s => ({ ...s, saving: false, error: 'Impossible de sauvegarder la progression. Vérifiez votre connexion ou rechargez la page.' }));
      return false;
    }
    setState(s => ({
      ...s,
      saving: false,
      data: newData,
      etape: actualNext,
    }));
    return true;
  }

  // Advance onboarding step from an external page (EntreprisePage, EspacesZonesPage, MotifsPage)
  async function advanceFromExternalPage(etabId: string, nextEtape: number): Promise<boolean> {
    const { error } = await supabase
      .from('etablissements')
      .update({
        onboarding_etape: nextEtape,
        onboarding_step: ETAPE_STEP_MAP[nextEtape] ?? 'entreprise',
      })
      .eq('id', etabId);
    return !error;
  }

  // Saves current state without advancing — used by "Je reviens plus tard"
  async function saveCurrentStep(etabId: string): Promise<void> {
    const { etape, data } = state;
    await supabase.from('etablissements').update({
      onboarding_data: data,
      onboarding_etape: etape,
      onboarding_step: ETAPE_STEP_MAP[etape] ?? 'welcome',
    }).eq('id', etabId);
  }

  async function activateClient(etabId: string): Promise<boolean> {
    setState(s => ({ ...s, saving: true, error: null }));

    const { error: rpcErr } = await supabase.rpc('activer_client', {
      p_etab_id: etabId,
      p_plan: state.data.plan,
    });
    if (rpcErr) {
      setState(s => ({ ...s, saving: false, error: "Erreur lors de l'activation." }));
      return false;
    }

    await supabase.from('etablissements').update({
      onboarding_data: { ...state.data, activated_at: new Date().toISOString() },
      onboarding_etape: 4,
      onboarding_step: 'done',
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', etabId);

    setState(s => ({ ...s, saving: false, activated: true }));
    return true;
  }

  function goToStep(n: number) {
    setState(s => ({ ...s, etape: n, error: null }));
  }

  return { state, updateData, initEtab, saveStep, advanceFromExternalPage, saveCurrentStep, activateClient, goToStep, setError };
}
