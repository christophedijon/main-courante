/*
  # Create evacuation_plans table

  1. New Tables
    - `evacuation_plans`
      - `id` (uuid, primary key)
      - `nom` (text) — display name for the plan
      - `file_url` (text) — public Storage URL
      - `file_path` (text) — Storage path used for deletion
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `evacuation_plans`
    - SELECT: authenticated users who are super_admins OR have fonction = 'Direction'
    - INSERT/UPDATE/DELETE: same restriction (super admins and Direction only)

  3. Notes
    - file_path is stored separately from file_url to allow clean Storage deletion
    - No foreign key to entreprise since there is only one entreprise row
*/

CREATE TABLE IF NOT EXISTS evacuation_plans (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text        NOT NULL DEFAULT '',
  file_url   text        NOT NULL DEFAULT '',
  file_path  text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE evacuation_plans ENABLE ROW LEVEL SECURITY;

-- Helper: returns true if the current user is a super admin or Direction
CREATE OR REPLACE FUNCTION is_direction_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction'
  );
$$;

CREATE POLICY "Direction and super admins can view evacuation plans"
  ON evacuation_plans FOR SELECT
  TO authenticated
  USING (is_direction_or_super_admin());

CREATE POLICY "Direction and super admins can insert evacuation plans"
  ON evacuation_plans FOR INSERT
  TO authenticated
  WITH CHECK (is_direction_or_super_admin());

CREATE POLICY "Direction and super admins can update evacuation plans"
  ON evacuation_plans FOR UPDATE
  TO authenticated
  USING (is_direction_or_super_admin())
  WITH CHECK (is_direction_or_super_admin());

CREATE POLICY "Direction and super admins can delete evacuation plans"
  ON evacuation_plans FOR DELETE
  TO authenticated
  USING (is_direction_or_super_admin());
