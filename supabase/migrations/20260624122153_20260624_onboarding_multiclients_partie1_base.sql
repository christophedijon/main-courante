-- ============================================================
-- ONBOARDING MULTI-CLIENTS — PARTIE 1/3 : BASE DE DONNÉES
-- ============================================================

-- SECTION 1 : Table partenaires (revendeurs)
-- ============================================================
CREATE TABLE partenaires (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             text        NOT NULL,
  raison_sociale  text,
  siret           text        UNIQUE,
  email           text        NOT NULL UNIQUE,
  telephone       text,
  adresse         text,
  ville           text,
  code_postal     text,
  user_id         uuid        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  commission_pct  numeric(5,2) DEFAULT 0,
  actif           boolean     DEFAULT true,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE partenaires ENABLE ROW LEVEL SECURITY;

-- SECTION 2 : Nouvelles colonnes sur etablissements
-- ============================================================
ALTER TABLE etablissements
  ADD COLUMN IF NOT EXISTS plan               text        NOT NULL DEFAULT 'light'
    CHECK (plan IN ('light','base','premium')),
  ADD COLUMN IF NOT EXISTS statut             text        NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','essai','actif','suspendu','resilie')),
  ADD COLUMN IF NOT EXISTS date_debut_essai   date,
  ADD COLUMN IF NOT EXISTS date_fin_essai     date,
  ADD COLUMN IF NOT EXISTS date_activation    date,
  ADD COLUMN IF NOT EXISTS partenaire_id      uuid        REFERENCES partenaires(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS essai_converti     boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean    DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_etape   integer     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_data    jsonb       DEFAULT '{}'::jsonb;

-- SECTION 3 : RLS — table partenaires
-- ============================================================

-- SuperAdmin / Direction : accès total
CREATE POLICY "partenaires_admin_all" ON partenaires
  FOR ALL TO authenticated
  USING (is_direction_or_super_admin())
  WITH CHECK (is_direction_or_super_admin());

-- Partenaire : lecture de sa propre ligne uniquement
CREATE POLICY "partenaires_self_select" ON partenaires
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Partenaire : modification de sa propre ligne uniquement
CREATE POLICY "partenaires_self_update" ON partenaires
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- SECTION 4 : RLS — accès partenaire sur etablissements
-- Les policies existantes (mega_admin, user_read_own) restent intactes.
-- On ajoute trois policies additives pour les partenaires.
-- ============================================================

-- Partenaire : lecture de ses clients
CREATE POLICY "partenaire_view_own_clients" ON etablissements
  FOR SELECT TO authenticated
  USING (
    partenaire_id = (SELECT id FROM partenaires WHERE user_id = auth.uid() LIMIT 1)
  );

-- Partenaire : création d'un nouvel établissement pour lui-même
CREATE POLICY "partenaire_create_clients" ON etablissements
  FOR INSERT TO authenticated
  WITH CHECK (
    partenaire_id = (SELECT id FROM partenaires WHERE user_id = auth.uid() LIMIT 1)
  );

-- Partenaire : modification de ses propres clients
CREATE POLICY "partenaire_update_own_clients" ON etablissements
  FOR UPDATE TO authenticated
  USING (
    partenaire_id = (SELECT id FROM partenaires WHERE user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    partenaire_id = (SELECT id FROM partenaires WHERE user_id = auth.uid() LIMIT 1)
  );

-- SECTION 5 : RPCs
-- ============================================================

-- 1. Crée un établissement vierge en statut brouillon
--    Utilisable par un super-admin ou un partenaire.
CREATE OR REPLACE FUNCTION public.creer_client_brouillon()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_etab_id       uuid;
  v_partenaire_id uuid;
BEGIN
  SELECT id INTO v_partenaire_id
  FROM partenaires
  WHERE user_id = auth.uid()
  LIMIT 1;

  INSERT INTO etablissements (
    nom, partenaire_id, plan, statut, onboarding_etape, onboarding_complete
  )
  VALUES (
    'Nouvel établissement',
    v_partenaire_id,
    'light',
    'brouillon',
    1,
    false
  )
  RETURNING id INTO v_etab_id;

  RETURN v_etab_id;
END;
$$;

-- 2. Active un client après la fin de l'onboarding
CREATE OR REPLACE FUNCTION public.activer_client(p_etab_id uuid, p_plan text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_statut text;
BEGIN
  IF p_plan NOT IN ('light', 'base', 'premium') THEN
    RAISE EXCEPTION 'Plan invalide: %', p_plan;
  END IF;

  v_statut := CASE WHEN p_plan = 'light' THEN 'essai' ELSE 'actif' END;

  UPDATE etablissements SET
    plan              = p_plan,
    statut            = v_statut,
    date_activation   = CURRENT_DATE,
    date_debut_essai  = CASE WHEN p_plan = 'light' THEN CURRENT_DATE ELSE NULL END,
    date_fin_essai    = CASE WHEN p_plan = 'light' THEN (CURRENT_DATE + INTERVAL '30 days')::date ELSE NULL END,
    onboarding_complete = true,
    essai_converti    = CASE WHEN p_plan != 'light' THEN true ELSE essai_converti END
  WHERE id = p_etab_id
    AND (
      is_direction_or_super_admin()
      OR partenaire_id = (SELECT id FROM partenaires WHERE user_id = auth.uid() LIMIT 1)
    );

  RETURN json_build_object('success', true, 'plan', p_plan, 'statut', v_statut);
END;
$$;

-- 3. Passe les essais expirés en 'suspendu' — à appeler via cron quotidien
CREATE OR REPLACE FUNCTION public.expirer_essais()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE etablissements
  SET statut = 'suspendu'
  WHERE statut = 'essai'
    AND date_fin_essai < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
