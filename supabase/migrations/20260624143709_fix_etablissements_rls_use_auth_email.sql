-- Fix: replace direct auth.users subquery with auth.email() built-in
-- in all etablissements policies that have the broken pattern
-- (same fix already applied to ia_settings in 20260504210433)

DROP POLICY IF EXISTS "super_admin_update_etablissements" ON etablissements;
DROP POLICY IF EXISTS "super_admin_view_all_etablissements" ON etablissements;
DROP POLICY IF EXISTS "super_admin_delete_brouillon_etablissements" ON etablissements;

CREATE POLICY "super_admin_view_all_etablissements" ON etablissements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "super_admin_update_etablissements" ON etablissements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = auth.email()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "super_admin_delete_brouillon_etablissements" ON etablissements
  FOR DELETE TO authenticated
  USING (
    statut = 'brouillon'
    AND EXISTS (
      SELECT 1 FROM super_admins
      WHERE email = auth.email()
    )
  );
