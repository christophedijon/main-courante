-- ══════════════════════════════════════════════════════════════════════════
-- CHANTIER 2 — ÉTAPE A : Isolation multi-tenant des tables motifs
-- Tables : motifs, motifs_ssi, niveaux_intervention
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1. ADD COLUMN etablissement_id (nullable d'abord) ────────────────────

ALTER TABLE motifs
  ADD COLUMN IF NOT EXISTS etablissement_id uuid;

ALTER TABLE motifs_ssi
  ADD COLUMN IF NOT EXISTS etablissement_id uuid;

ALTER TABLE niveaux_intervention
  ADD COLUMN IF NOT EXISTS etablissement_id uuid;

-- ─── 2. Migrer les données existantes vers SARL GARI ─────────────────────

UPDATE motifs
SET etablissement_id = 'd870f00c-6b7f-4324-accb-d38e7ba53b5c'
WHERE etablissement_id IS NULL;

UPDATE motifs_ssi
SET etablissement_id = 'd870f00c-6b7f-4324-accb-d38e7ba53b5c'
WHERE etablissement_id IS NULL;

UPDATE niveaux_intervention
SET etablissement_id = 'd870f00c-6b7f-4324-accb-d38e7ba53b5c'
WHERE etablissement_id IS NULL;

-- ─── 3. Passer NOT NULL maintenant que toutes les lignes sont renseignées ─

ALTER TABLE motifs
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE motifs_ssi
  ALTER COLUMN etablissement_id SET NOT NULL;

ALTER TABLE niveaux_intervention
  ALTER COLUMN etablissement_id SET NOT NULL;

-- ─── 4. Supprimer toutes les anciennes policies motifs ────────────────────

DROP POLICY IF EXISTS "Allow authenticated to read motifs"     ON motifs;
DROP POLICY IF EXISTS "Super admins can select motifs"         ON motifs;
DROP POLICY IF EXISTS "Super admins can insert motifs"         ON motifs;
DROP POLICY IF EXISTS "Super admins can update motifs"         ON motifs;
DROP POLICY IF EXISTS "Super admins can delete motifs"         ON motifs;

-- ─── 5. Nouvelles policies motifs ────────────────────────────────────────

CREATE POLICY "select_own_motifs" ON motifs
  FOR SELECT TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "insert_own_motifs" ON motifs
  FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "update_own_motifs" ON motifs
  FOR UPDATE TO authenticated
  USING  (etablissement_id = get_user_etablissement_id() OR is_super_admin())
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "delete_own_motifs" ON motifs
  FOR DELETE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());

-- ─── 6. Supprimer toutes les anciennes policies motifs_ssi ───────────────

DROP POLICY IF EXISTS "Authenticated users can read motifs_ssi" ON motifs_ssi;
DROP POLICY IF EXISTS "Super admins can insert motifs_ssi"      ON motifs_ssi;
DROP POLICY IF EXISTS "Super admins can update motifs_ssi"      ON motifs_ssi;
DROP POLICY IF EXISTS "Super admins can delete motifs_ssi"      ON motifs_ssi;

-- ─── 7. Nouvelles policies motifs_ssi ────────────────────────────────────

CREATE POLICY "select_own_motifs_ssi" ON motifs_ssi
  FOR SELECT TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "insert_own_motifs_ssi" ON motifs_ssi
  FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "update_own_motifs_ssi" ON motifs_ssi
  FOR UPDATE TO authenticated
  USING  (etablissement_id = get_user_etablissement_id() OR is_super_admin())
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "delete_own_motifs_ssi" ON motifs_ssi
  FOR DELETE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());

-- ─── 8. Supprimer toutes les anciennes policies niveaux_intervention ──────

DROP POLICY IF EXISTS "Allow authenticated to read niveaux_intervention" ON niveaux_intervention;
DROP POLICY IF EXISTS "Super admins can select niveaux"                  ON niveaux_intervention;
DROP POLICY IF EXISTS "Super admins can insert niveaux"                  ON niveaux_intervention;
DROP POLICY IF EXISTS "Super admins can update niveaux"                  ON niveaux_intervention;
DROP POLICY IF EXISTS "Super admins can delete niveaux"                  ON niveaux_intervention;

-- ─── 9. Nouvelles policies niveaux_intervention ───────────────────────────

CREATE POLICY "select_own_niveaux" ON niveaux_intervention
  FOR SELECT TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "insert_own_niveaux" ON niveaux_intervention
  FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "update_own_niveaux" ON niveaux_intervention
  FOR UPDATE TO authenticated
  USING  (etablissement_id = get_user_etablissement_id() OR is_super_admin())
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_super_admin());

CREATE POLICY "delete_own_niveaux" ON niveaux_intervention
  FOR DELETE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());
