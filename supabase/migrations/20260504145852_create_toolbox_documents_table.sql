/*
  # Create toolbox_documents table

  1. New Tables
    - `toolbox_documents`
      - `id` (uuid, primary key)
      - `titre` (text, required) — document title
      - `description` (text, optional) — short subtitle
      - `contenu` (text, required) — rich text / long content
      - `categorie` (text, constrained: RONDE | SSI | PROCEDURE | RADIO)
      - `ordre` (integer, default 0) — display order within category
      - `actif` (boolean, default true) — visibility on mobile
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS
    - Super admins (matched by email from super_admins table) have full access
    - All authenticated users can SELECT active documents (future mobile use)

  3. Index
    - Index on (categorie, ordre) for efficient category queries
*/

CREATE TABLE IF NOT EXISTS toolbox_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  contenu     text NOT NULL DEFAULT '',
  categorie   text NOT NULL CHECK (categorie IN ('RONDE', 'SSI', 'PROCEDURE', 'RADIO')),
  ordre       integer NOT NULL DEFAULT 0,
  actif       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS toolbox_documents_categorie_ordre
  ON toolbox_documents (categorie, ordre);

ALTER TABLE toolbox_documents ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything (identified by email in super_admins table)
CREATE POLICY "Super admins can select toolbox documents"
  ON toolbox_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Super admins can insert toolbox documents"
  ON toolbox_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Super admins can update toolbox documents"
  ON toolbox_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Super admins can delete toolbox documents"
  ON toolbox_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (auth.jwt() ->> 'email')
    )
  );

-- All authenticated users can read active documents (future mobile consumption)
CREATE POLICY "Authenticated users can read active toolbox documents"
  ON toolbox_documents FOR SELECT
  TO authenticated
  USING (actif = true);
