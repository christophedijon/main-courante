/*
  # Create espaces and zones tables

  1. New Tables
    - `espaces`
      - `id` (uuid, primary key)
      - `nom` (text) — name of the space
      - `description` (text) — optional description
      - `couleur` (text) — hex color for visual identification
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `zones`
      - `id` (uuid, primary key)
      - `espace_id` (uuid, FK -> espaces.id)
      - `nom` (text) — name of the zone
      - `description` (text) — optional description
      - `capacite` (integer, nullable) — max capacity
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Only authenticated users with super_admin or Direction role can read/write
    - Using is_direction_or_super_admin() helper if it exists, otherwise checking super_admins table
    - All authenticated users can read (for potential usage in other features)
    - Only admins/direction can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS espaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  couleur     text NOT NULL DEFAULT '#3b82f6',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE espaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS zones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espace_id   uuid NOT NULL REFERENCES espaces(id) ON DELETE CASCADE,
  nom         text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  capacite    integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_zones_espace_id ON zones(espace_id);

-- Espaces: read by all authenticated users
CREATE POLICY "Authenticated users can view espaces"
  ON espaces FOR SELECT
  TO authenticated
  USING (true);

-- Espaces: insert/update/delete only by admins (super_admins table) or Direction
CREATE POLICY "Admins can insert espaces"
  ON espaces FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can update espaces"
  ON espaces FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can delete espaces"
  ON espaces FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

-- Zones: same pattern
CREATE POLICY "Authenticated users can view zones"
  ON zones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert zones"
  ON zones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can update zones"
  ON zones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );

CREATE POLICY "Admins can delete zones"
  ON zones FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = auth.jwt()->>'email')
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction = 'Direction')
  );
