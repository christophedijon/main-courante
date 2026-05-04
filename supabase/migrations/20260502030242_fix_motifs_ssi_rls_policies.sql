/*
  # Fix motifs_ssi RLS policies

  The INSERT/UPDATE/DELETE policies used a JOIN on auth.users which is not
  accessible to the authenticated role. Replace with the same pattern used
  on espaces/zones: compare super_admins.email against auth.jwt()->>'email'.
*/

DROP POLICY IF EXISTS "Super admins can insert motifs_ssi" ON motifs_ssi;
DROP POLICY IF EXISTS "Super admins can update motifs_ssi" ON motifs_ssi;
DROP POLICY IF EXISTS "Super admins can delete motifs_ssi" ON motifs_ssi;

CREATE POLICY "Super admins can insert motifs_ssi"
  ON motifs_ssi FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
  );

CREATE POLICY "Super admins can update motifs_ssi"
  ON motifs_ssi FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
  );

CREATE POLICY "Super admins can delete motifs_ssi"
  ON motifs_ssi FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
  );
