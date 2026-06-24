-- ============================================================
-- FIX 10: Drop USING(true) / WITH CHECK(true) policies that
-- bypass tenant isolation via OR short-circuit logic.
--
-- PostgreSQL combines permissive policies with OR, so any
-- USING(true) on a table renders all other USING() conditions
-- on the same command irrelevant.  Where a proper *_isolation
-- (FOR ALL) policy already exists we simply remove the open
-- policy.  For tables with no isolation policy we add one.
-- ============================================================

-- 1. evenements
-- evenements_isolation (FOR ALL) already enforces establishment
-- scoping for both SELECT and INSERT.
DROP POLICY IF EXISTS "evenements_select_authenticated" ON evenements;
DROP POLICY IF EXISTS "evenements_insert_authenticated" ON evenements;

-- 2. jauge_actions
-- jauge_actions_isolation (FOR ALL) handles SELECT + INSERT.
DROP POLICY IF EXISTS "Authenticated users can read jauge_actions" ON jauge_actions;
DROP POLICY IF EXISTS "Authenticated users can insert jauge_actions" ON jauge_actions;

-- 3. jauge_etat
-- jauge_etat_isolation (FOR ALL) handles SELECT + INSERT + UPDATE.
DROP POLICY IF EXISTS "Authenticated users can read jauge_etat" ON jauge_etat;
DROP POLICY IF EXISTS "Authenticated users can insert jauge_etat" ON jauge_etat;
DROP POLICY IF EXISTS "Authenticated users can update jauge_etat" ON jauge_etat;

-- 4. event_commentaires
-- event_commentaires_isolation (FOR ALL) handles SELECT + INSERT.
DROP POLICY IF EXISTS "auth read" ON event_commentaires;
DROP POLICY IF EXISTS "auth insert" ON event_commentaires;

-- 5. registre_historique
-- registre_historique_isolation (FOR ALL) handles SELECT + INSERT.
DROP POLICY IF EXISTS "registre_historique_select" ON registre_historique;
DROP POLICY IF EXISTS "registre_historique_insert" ON registre_historique;

-- 6. registre_signatures
-- registre_sig_isolation (FOR ALL) handles SELECT.
DROP POLICY IF EXISTS "registre_signatures_select" ON registre_signatures;

-- 7. rapports_soiree
-- rapports_isolation (FOR ALL) handles SELECT.
DROP POLICY IF EXISTS "Authenticated users can view rapports" ON rapports_soiree;

-- 8. zones_ssi — all four operations were USING(true)
-- zones_ssi_isolation (FOR ALL) handles all operations.
DROP POLICY IF EXISTS "zones_ssi_select" ON zones_ssi;
DROP POLICY IF EXISTS "zones_ssi_insert" ON zones_ssi;
DROP POLICY IF EXISTS "zones_ssi_update" ON zones_ssi;
DROP POLICY IF EXISTS "zones_ssi_delete" ON zones_ssi;

-- 9. rapport_email_settings
-- This table has an etablissement_id column but had no isolation
-- policy — all three operations were fully open.
DROP POLICY IF EXISTS "rapport_email_settings_select" ON rapport_email_settings;
DROP POLICY IF EXISTS "rapport_email_settings_insert" ON rapport_email_settings;
DROP POLICY IF EXISTS "rapport_email_settings_update" ON rapport_email_settings;

CREATE POLICY "rapport_email_settings_select_own_etab"
  ON rapport_email_settings FOR SELECT
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

CREATE POLICY "rapport_email_settings_insert_own_etab"
  ON rapport_email_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

CREATE POLICY "rapport_email_settings_update_own_etab"
  ON rapport_email_settings FOR UPDATE
  TO authenticated
  USING  (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

-- 10. evenement_motifs
-- No direct etablissement_id — scope through the parent evenements row.
-- The SELECT USING(true) and INSERT WITH CHECK (auth.uid() IS NOT NULL)
-- both allowed cross-tenant access.
DROP POLICY IF EXISTS "evenement_motifs_select_authenticated" ON evenement_motifs;
DROP POLICY IF EXISTS "evenement_motifs_insert_authenticated" ON evenement_motifs;

CREATE POLICY "evenement_motifs_select_own_etab"
  ON evenement_motifs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evenements e
      WHERE e.id = evenement_id
        AND (is_super_admin() OR e.etablissement_id = get_my_entreprise_id())
    )
  );

CREATE POLICY "evenement_motifs_insert_own_etab"
  ON evenement_motifs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evenements e
      WHERE e.id = evenement_id
        AND (is_super_admin() OR e.etablissement_id = get_my_entreprise_id())
    )
  );
