/*
  # Add user profiles table linked to Supabase Auth

  ## Summary
  Users created by the super admin are now real Supabase Auth accounts.
  Their profile (first name, last name) is stored in a separate `user_profiles`
  table that the user can update themselves after logging in.

  ## Changes

  ### New Table: `user_profiles`
  - `id` (uuid, primary key, FK → auth.users.id) — one row per auth user
  - `first_name` (text) — editable by the owner
  - `last_name` (text) — editable by the owner
  - `updated_at` (timestamptz)

  ### Modified Table: `managed_users`
  - Removes the `name` column (no longer needed — identity tracked via email)
  - Adds `auth_user_id` (uuid, nullable FK → auth.users.id) so we can link the
    managed_users record to the corresponding auth account

  ## Security
  - RLS enabled on `user_profiles`
  - Users can read/update their own profile row only
  - Super admins can read any profile (for display in the back office)
*/

-- ── user_profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  text NOT NULL DEFAULT '',
  last_name   text NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- ── managed_users: add auth_user_id, drop name ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'managed_users' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE managed_users ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'managed_users' AND column_name = 'name'
  ) THEN
    ALTER TABLE managed_users DROP COLUMN name;
  END IF;
END $$;
