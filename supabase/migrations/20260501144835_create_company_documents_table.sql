/*
  # Create company_documents table

  1. New Tables
    - `company_documents`
      - `id` (uuid, primary key)
      - `nom` (text) — display name for the document
      - `file_url` (text) — public Storage URL
      - `file_path` (text) — Storage path used for deletion
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `company_documents`
    - SELECT / INSERT / UPDATE / DELETE: authenticated users who are super admins OR have fonction = 'Direction'
    - Reuses the existing `is_direction_or_super_admin()` function

  3. Notes
    - Files will be stored under `company-docs/` in the existing `documents` bucket
    - Separate from `evacuation_plans` so each type can evolve independently
*/

CREATE TABLE IF NOT EXISTS company_documents (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text        NOT NULL DEFAULT '',
  file_url   text        NOT NULL DEFAULT '',
  file_path  text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Direction and super admins can view company documents"
  ON company_documents FOR SELECT
  TO authenticated
  USING (is_direction_or_super_admin());

CREATE POLICY "Direction and super admins can insert company documents"
  ON company_documents FOR INSERT
  TO authenticated
  WITH CHECK (is_direction_or_super_admin());

CREATE POLICY "Direction and super admins can update company documents"
  ON company_documents FOR UPDATE
  TO authenticated
  USING (is_direction_or_super_admin())
  WITH CHECK (is_direction_or_super_admin());

CREATE POLICY "Direction and super admins can delete company documents"
  ON company_documents FOR DELETE
  TO authenticated
  USING (is_direction_or_super_admin());
