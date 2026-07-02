-- jauge_etat and jauge_actions isolation policies reference entreprise_id
-- which is NULL on all rows since the migration to etablissement_id.
-- Fix: switch USING clause to etablissement_id.

DROP POLICY IF EXISTS "jauge_etat_isolation" ON jauge_etat;
CREATE POLICY "jauge_etat_isolation" ON jauge_etat
  FOR ALL TO authenticated
  USING (is_super_admin() OR etablissement_id = get_my_entreprise_id());

DROP POLICY IF EXISTS "jauge_actions_isolation" ON jauge_actions;
CREATE POLICY "jauge_actions_isolation" ON jauge_actions
  FOR ALL TO authenticated
  USING (is_super_admin() OR etablissement_id = get_my_entreprise_id());
