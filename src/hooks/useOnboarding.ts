import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { type OnboardingData, INITIAL_DATA, TEMPLATES_POSTES } from '../pages/onboarding/types';

export interface OnboardingState {
  etabId: string | null;
  etape: number;
  data: OnboardingData;
  saving: boolean;
  error: string | null;
  activated: boolean;
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    etabId: null,
    etape: 1,
    data: { ...INITIAL_DATA },
    saving: false,
    error: null,
    activated: false,
  });

  const setError = (error: string | null) =>
    setState(s => ({ ...s, error }));

  const updateData = useCallback((patch: Partial<OnboardingData>) => {
    setState(s => ({ ...s, data: { ...s.data, ...patch } }));
  }, []);

  async function initEtab(): Promise<string | null> {
    setState(s => ({ ...s, saving: true, error: null }));
    const { data, error } = await supabase.rpc('creer_client_brouillon');
    if (error || !data) {
      setState(s => ({ ...s, saving: false, error: "Impossible de créer le brouillon." }));
      return null;
    }
    setState(s => ({ ...s, etabId: data as string, saving: false }));
    return data as string;
  }

  async function saveStep(etabId: string, etape: number, patch: Partial<OnboardingData>): Promise<boolean> {
    setState(s => ({ ...s, saving: true, error: null }));
    const newData = { ...state.data, ...patch };

    const { error } = await supabase
      .from('etablissements')
      .update({
        onboarding_data: newData,
        onboarding_etape: etape + 1,
        ...(etape === 1 && {
          nom: newData.nom,
          plan: newData.plan,
        }),
      })
      .eq('id', etabId);

    if (error) {
      setState(s => ({ ...s, saving: false, error: "Erreur lors de la sauvegarde." }));
      return false;
    }
    setState(s => ({
      ...s,
      saving: false,
      data: newData,
      etape: etape + 1,
    }));
    return true;
  }

  async function createDirectionUser(
    etabId: string,
    email: string,
    prenom: string,
    nom: string,
    telephone: string,
  ): Promise<{ managed_id: string; auth_user_id: string } | null> {
    setState(s => ({ ...s, saving: true, error: null }));

    const { data, error } = await supabase.functions.invoke('create-managed-user', {
      body: {
        email,
        fonction: 'Direction',
        status: 'active',
        etablissement_id: etabId,
        invite: true,
      },
    });

    if (error || data?.error) {
      setState(s => ({
        ...s,
        saving: false,
        error: data?.error ?? "Impossible de créer le compte Direction.",
      }));
      return null;
    }

    setState(s => ({ ...s, saving: false }));
    return { managed_id: data.user.id, auth_user_id: data.user.auth_user_id };
  }

  async function activateClient(etabId: string): Promise<boolean> {
    setState(s => ({ ...s, saving: true, error: null }));

    // 1. Call the activer_client RPC
    const { error: rpcErr } = await supabase.rpc('activer_client', {
      p_etab_id: etabId,
      p_plan: state.data.plan,
    });
    if (rpcErr) {
      setState(s => ({ ...s, saving: false, error: "Erreur lors de l'activation." }));
      return false;
    }

    // 2. Create espaces in the database
    if (state.data.espaces.length > 0) {
      const { error: espErr } = await supabase.from('espaces').insert(
        state.data.espaces.map(e => ({
          nom: e.nom,
          couleur: e.couleur || '#3b82f6',
          etablissement_id: etabId,
        }))
      );
      if (espErr) console.warn('espaces insert error:', espErr);
    }

    // 3. Create zones in the database
    if (state.data.zones.length > 0) {
      const { error: zoneErr } = await supabase.from('zones').insert(
        state.data.zones.map(z => ({
          nom: z.nom,
          categorie: z.categorie || 'securite_personnes',
          capacite: z.capacite || null,
          etablissement_id: etabId,
        }))
      );
      if (zoneErr) console.warn('zones insert error:', zoneErr);
    }

    // 4. Mark onboarding_data with activation info
    await supabase.from('etablissements').update({
      onboarding_data: { ...state.data, activated_at: new Date().toISOString() },
      onboarding_etape: 6,
    }).eq('id', etabId);

    setState(s => ({ ...s, saving: false, activated: true }));
    return true;
  }

  async function loadPostesTemplate(
    etabId: string,
    template: keyof typeof TEMPLATES_POSTES,
  ): Promise<boolean> {
    setState(s => ({ ...s, saving: true, error: null }));
    const postes = TEMPLATES_POSTES[template];
    const { error } = await supabase.from('postes').insert(
      postes.map(p => ({ ...p, actif: true, etablissement_id: etabId }))
    );
    if (error) {
      setState(s => ({ ...s, saving: false, error: "Erreur lors du chargement du template." }));
      return false;
    }
    setState(s => ({ ...s, saving: false }));
    return true;
  }

  function goToStep(n: number) {
    setState(s => ({ ...s, etape: n, error: null }));
  }

  return { state, updateData, initEtab, saveStep, createDirectionUser, activateClient, loadPostesTemplate, goToStep, setError };
}
