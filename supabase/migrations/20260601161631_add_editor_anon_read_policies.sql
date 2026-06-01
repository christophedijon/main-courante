/*
  # Add editor anon-read policies for back-office tables

  ## Context
  When the editor logs in via /editor, a Supabase anonymous auth session is created
  (signInAnonymously). Anonymous sessions satisfy TO authenticated, but the existing
  restrictive USING conditions (email/uid checks) block access.

  ## Changes
  For each table that has a restrictive USING condition, add a new SELECT policy
  that grants read access when auth.jwt()->>'role' = 'anon' (anonymous session).
  Tables already using USING (true) need no additional policy.

  ## Tables requiring new policies
  - managed_users    (USING: is_super_admin() check)
  - user_profiles    (USING: auth.uid() = id)
  - ia_settings      (USING: super_admins email check)
  - email_rules      (USING: super_admins email check)
  - toolbox_documents (USING: super_admins email check — all docs variant)
  - company_documents (USING: is_direction_or_super_admin())
  - evacuation_plans  (USING: is_direction_or_super_admin())

  ## Security
  All policies are SELECT-only and scoped to anonymous sessions.
  Anon users cannot insert, update, or delete any data.
*/

-- managed_users: editor can read all agents (needed for user list, postes, etc.)
CREATE POLICY "Editor anon can read managed_users"
  ON managed_users FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');

-- user_profiles: editor can read all profiles
CREATE POLICY "Editor anon can read user_profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');

-- ia_settings: editor can read IA config
CREATE POLICY "Editor anon can read ia_settings"
  ON ia_settings FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');

-- email_rules: editor can read email rules
CREATE POLICY "Editor anon can read email_rules"
  ON email_rules FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');

-- toolbox_documents: editor can read all toolbox docs (active or not)
CREATE POLICY "Editor anon can read toolbox_documents"
  ON toolbox_documents FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');

-- company_documents: editor can read evacuation plans / company docs
CREATE POLICY "Editor anon can read company_documents"
  ON company_documents FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');

-- evacuation_plans: editor can read evacuation plans
CREATE POLICY "Editor anon can read evacuation_plans"
  ON evacuation_plans FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');

-- super_admins: editor can read the list (needed for admin pages)
CREATE POLICY "Editor anon can read super_admins"
  ON super_admins FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'anon');
