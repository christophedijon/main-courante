/*
# Add _isolation RLS policies for remaining tenant-scoped tables

## Context
The project uses `etablissement_id` as the tenant isolation column.
The function `get_my_entreprise_id()` is an alias for `get_user_etablissement_id()`.
19 tables already have a `<table>_isolation` FOR ALL policy using:
  (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))

## Changes
Adds the same `_isolation` FOR ALL policy to 15 tables that were missing it:

### Direct etablissement_id (12 tables)
- assignations, company_documents, espaces, evacuation_plans, evenements,
  motifs, motifs_ssi, niveaux_intervention, rapport_email_settings,
  toolbox_documents, zones, zones_ssi

### Indirect isolation via parent table (3 tables)
- evenement_medias      -> join via evenement_id    -> evenements.etablissement_id
- evenement_motifs      -> join via evenement_id    -> evenements.etablissement_id
- rondes_config_balises -> join via ronde_config_id -> rondes_config.etablissement_id

## Security
Each policy is FOR ALL TO authenticated, idempotent (DROP IF EXISTS first).
These policies act as an additional safety net alongside existing per-CRUD policies.
Super admins bypass isolation via is_super_admin().

## Excluded tables (no etablissement_id or ambiguous - left untouched)
- app_secrets: global, service_role only
- etablissements: root entity, has own complex policies
- ia_settings: global config, super_admin only
- partenaires: uses user_id, different model
- super_admins: email-based access, needs separate decision
- reminder_logs: service_role only, needs separate decision
*/

-- ============================================================
-- Direct etablissement_id isolation (12 tables)
-- ============================================================

DROP POLICY IF EXISTS "assignations_isolation" ON assignations;
CREATE POLICY "assignations_isolation" ON assignations FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "company_documents_isolation" ON company_documents;
CREATE POLICY "company_documents_isolation" ON company_documents FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "espaces_isolation" ON espaces;
CREATE POLICY "espaces_isolation" ON espaces FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "evacuation_plans_isolation" ON evacuation_plans;
CREATE POLICY "evacuation_plans_isolation" ON evacuation_plans FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "evenements_isolation" ON evenements;
CREATE POLICY "evenements_isolation" ON evenements FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "motifs_isolation" ON motifs;
CREATE POLICY "motifs_isolation" ON motifs FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "motifs_ssi_isolation" ON motifs_ssi;
CREATE POLICY "motifs_ssi_isolation" ON motifs_ssi FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "niveaux_intervention_isolation" ON niveaux_intervention;
CREATE POLICY "niveaux_intervention_isolation" ON niveaux_intervention FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "rapport_email_settings_isolation" ON rapport_email_settings;
CREATE POLICY "rapport_email_settings_isolation" ON rapport_email_settings FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "toolbox_documents_isolation" ON toolbox_documents;
CREATE POLICY "toolbox_documents_isolation" ON toolbox_documents FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "zones_isolation" ON zones;
CREATE POLICY "zones_isolation" ON zones FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "zones_ssi_isolation" ON zones_ssi;
CREATE POLICY "zones_ssi_isolation" ON zones_ssi FOR ALL
  TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

-- ============================================================
-- Indirect isolation via parent table (3 tables)
-- ============================================================

DROP POLICY IF EXISTS "evenement_medias_isolation" ON evenement_medias;
CREATE POLICY "evenement_medias_isolation" ON evenement_medias FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR (evenement_id IN (
      SELECT evenements.id FROM evenements
      WHERE evenements.etablissement_id = get_my_entreprise_id()
    ))
  )
  WITH CHECK (
    is_super_admin()
    OR (evenement_id IN (
      SELECT evenements.id FROM evenements
      WHERE evenements.etablissement_id = get_my_entreprise_id()
    ))
  );

DROP POLICY IF EXISTS "evenement_motifs_isolation" ON evenement_motifs;
CREATE POLICY "evenement_motifs_isolation" ON evenement_motifs FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR (evenement_id IN (
      SELECT evenements.id FROM evenements
      WHERE evenements.etablissement_id = get_my_entreprise_id()
    ))
  )
  WITH CHECK (
    is_super_admin()
    OR (evenement_id IN (
      SELECT evenements.id FROM evenements
      WHERE evenements.etablissement_id = get_my_entreprise_id()
    ))
  );

DROP POLICY IF EXISTS "rondes_config_balises_isolation" ON rondes_config_balises;
CREATE POLICY "rondes_config_balises_isolation" ON rondes_config_balises FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR (ronde_config_id IN (
      SELECT rondes_config.id FROM rondes_config
      WHERE rondes_config.etablissement_id = get_my_entreprise_id()
    ))
  )
  WITH CHECK (
    is_super_admin()
    OR (ronde_config_id IN (
      SELECT rondes_config.id FROM rondes_config
      WHERE rondes_config.etablissement_id = get_my_entreprise_id()
    ))
  );
