/*
  # Create motifs_ssi table

  1. New Tables
    - `motifs_ssi`
      - `id` (uuid, primary key)
      - `nom` (text)
      - `description` (text)
      - `ordre` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - SELECT: authenticated users
    - INSERT/UPDATE/DELETE: super admins only (matched via email in super_admins table)
*/

CREATE TABLE IF NOT EXISTS motifs_ssi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE motifs_ssi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read motifs_ssi"
  ON motifs_ssi FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert motifs_ssi"
  ON motifs_ssi FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins sa
      JOIN auth.users u ON u.email = sa.email
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update motifs_ssi"
  ON motifs_ssi FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      JOIN auth.users u ON u.email = sa.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins sa
      JOIN auth.users u ON u.email = sa.email
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete motifs_ssi"
  ON motifs_ssi FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      JOIN auth.users u ON u.email = sa.email
      WHERE u.id = auth.uid()
    )
  );
