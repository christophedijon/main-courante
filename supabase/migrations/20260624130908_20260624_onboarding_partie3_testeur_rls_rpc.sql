-- ============================================================
-- ONBOARDING PARTIE 3/3 — Plan Testeur + RLS + RPC
-- ============================================================

-- 1. Ajouter 'testeur' au plan CHECK
ALTER TABLE etablissements
  DROP CONSTRAINT IF EXISTS etablissements_plan_check;

ALTER TABLE etablissements
  ADD CONSTRAINT etablissements_plan_check
  CHECK (plan IN ('testeur', 'light', 'base', 'premium'));

-- 2. Politique SELECT pour les super_admins (table super_admins, pas managed_users)
--    Permet aux admins plateforme de voir tous les établissements depuis /clients.
CREATE POLICY "super_admin_view_all_etablissements" ON etablissements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 3. Politique UPDATE pour les super_admins sur établissements
--    Permet de changer plan/statut depuis /clients.
CREATE POLICY "super_admin_update_etablissements" ON etablissements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 4. Politique DELETE pour les super_admins (brouillons uniquement)
CREATE POLICY "super_admin_delete_brouillon_etablissements" ON etablissements
  FOR DELETE TO authenticated
  USING (
    statut = 'brouillon'
    AND EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 5. Mettre à jour activer_client pour gérer le plan 'testeur' (6 mois)
CREATE OR REPLACE FUNCTION public.activer_client(p_etab_id uuid, p_plan text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_statut text;
BEGIN
  IF p_plan NOT IN ('testeur', 'light', 'base', 'premium') THEN
    RAISE EXCEPTION 'Plan invalide: %', p_plan;
  END IF;

  v_statut := CASE
    WHEN p_plan IN ('light', 'testeur') THEN 'essai'
    ELSE 'actif'
  END;

  UPDATE etablissements SET
    plan              = p_plan,
    statut            = v_statut,
    date_activation   = CURRENT_DATE,
    date_debut_essai  = CASE WHEN p_plan IN ('light','testeur') THEN CURRENT_DATE ELSE NULL END,
    date_fin_essai    = CASE
      WHEN p_plan = 'light'   THEN (CURRENT_DATE + INTERVAL '30 days')::date
      WHEN p_plan = 'testeur' THEN (CURRENT_DATE + INTERVAL '6 months')::date
      ELSE NULL
    END,
    onboarding_complete = true,
    essai_converti    = CASE WHEN p_plan NOT IN ('light','testeur') THEN true ELSE essai_converti END
  WHERE id = p_etab_id
    AND (
      is_direction_or_super_admin()
      OR EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
      OR partenaire_id = (SELECT id FROM partenaires WHERE user_id = auth.uid() LIMIT 1)
    );

  RETURN json_build_object('success', true, 'plan', p_plan, 'statut', v_statut);
END;
$$;

-- 6. Mettre à jour expirer_essais pour exclure les testeurs
CREATE OR REPLACE FUNCTION public.expirer_essais()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE etablissements
  SET statut = 'suspendu'
  WHERE statut = 'essai'
    AND plan != 'testeur'
    AND date_fin_essai < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
