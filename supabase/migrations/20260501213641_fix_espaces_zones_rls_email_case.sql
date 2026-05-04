/*
  # Fix espaces/zones RLS policies — case-insensitive email match

  ## Problem
  Insert/update/delete policies on `espaces` and `zones` compared
  `auth.jwt()->>'email'` directly with `super_admins.email`. If the JWT email
  casing differed from the stored email, the check failed and legitimate
  admins saw "Erreur lors de la création."

  ## Changes
  - Drop and recreate all write policies (INSERT/UPDATE/DELETE) on `espaces`
    and `zones` using lower() on both sides of the email comparison.
  - Keeps the same authorization model: super_admins OR managed_users with
    fonction = 'Direction'.

  ## Security
  - RLS remains enabled
  - No widening of access — only normalization of email comparison
*/

-- espaces
DROP POLICY IF EXISTS "Admins can insert espaces" ON espaces;
DROP POLICY IF EXISTS "Admins can update espaces" ON espaces;
DROP POLICY IF EXISTS "Admins can delete espaces" ON espaces;

CREATE POLICY "Admins can insert espaces"
  ON espaces FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can update espaces"
  ON espaces FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can delete espaces"
  ON espaces FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

-- zones
DROP POLICY IF EXISTS "Admins can insert zones" ON zones;
DROP POLICY IF EXISTS "Admins can update zones" ON zones;
DROP POLICY IF EXISTS "Admins can delete zones" ON zones;

CREATE POLICY "Admins can insert zones"
  ON zones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can update zones"
  ON zones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can delete zones"
  ON zones FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = lower(auth.jwt()->>'email'))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );
