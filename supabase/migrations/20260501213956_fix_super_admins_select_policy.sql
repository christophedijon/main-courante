/*
  # Fix super_admins SELECT policy to avoid auth.users access

  ## Problem
  The existing SELECT policy on `super_admins` used a sub-SELECT on `auth.users`,
  which is not readable by the `authenticated` role. This caused
  "permission denied for table users" whenever any other policy checked
  membership with `EXISTS (SELECT 1 FROM super_admins ...)` — for example
  when inserting into `espaces` or `zones`.

  ## Changes
  - Drop the old policy "Super admin reads own record"
  - Create a new SELECT policy that compares `super_admins.email` with
    `auth.jwt()->>'email'` (case-insensitive), avoiding any access to
    `auth.users`.

  ## Security
  - RLS remains enabled on `super_admins`
  - A user can still only read their own super_admins row
*/

DROP POLICY IF EXISTS "Super admin reads own record" ON super_admins;

CREATE POLICY "Super admin reads own record"
  ON super_admins FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'));
