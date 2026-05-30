/*
  # Create editor_sessions table

  ## Purpose
  Allows SuperAdmin/Direction to generate a temporary 4-digit access code for editor (support) access.

  ## New Tables
  - `editor_sessions`
    - `id` (uuid, primary key)
    - `entreprise_id` (uuid, FK → entreprise.id, cascade delete)
    - `code` (char(4), the 4-digit access code)
    - `created_at` (timestamptz, when the code was generated)
    - `connected_at` (timestamptz, when the editor last connected, nullable)
    - `revoked_at` (timestamptz, when the session was revoked, nullable)
    - `is_active` (boolean, whether the session is still valid)

  ## Security
  - RLS enabled — only authenticated users who belong to the entreprise can read/insert/update
  - SuperAdmin/Direction can manage sessions for their entreprise

  ## Realtime
  - Table added to supabase_realtime publication for live updates
*/

CREATE TABLE IF NOT EXISTS editor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprise(id) ON DELETE CASCADE,
  code char(4) NOT NULL,
  created_at timestamptz DEFAULT now(),
  connected_at timestamptz,
  revoked_at timestamptz,
  is_active boolean DEFAULT true
);

ALTER TABLE editor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read editor sessions for their entreprise"
  ON editor_sessions FOR SELECT
  TO authenticated
  USING (
    entreprise_id IN (
      SELECT entreprise_id FROM super_admins WHERE email = auth.jwt()->>'email'
      UNION
      SELECT entreprise_id FROM managed_users WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can insert editor sessions for their entreprise"
  ON editor_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    entreprise_id IN (
      SELECT entreprise_id FROM super_admins WHERE email = auth.jwt()->>'email'
      UNION
      SELECT entreprise_id FROM managed_users WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can update editor sessions for their entreprise"
  ON editor_sessions FOR UPDATE
  TO authenticated
  USING (
    entreprise_id IN (
      SELECT entreprise_id FROM super_admins WHERE email = auth.jwt()->>'email'
      UNION
      SELECT entreprise_id FROM managed_users WHERE email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    entreprise_id IN (
      SELECT entreprise_id FROM super_admins WHERE email = auth.jwt()->>'email'
      UNION
      SELECT entreprise_id FROM managed_users WHERE email = auth.jwt()->>'email'
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE editor_sessions;
