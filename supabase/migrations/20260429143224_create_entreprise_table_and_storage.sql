/*
  # Create entreprise table and logo storage

  1. New Tables
    - `entreprise`
      - `id` (uuid, primary key) — single row enforced by unique constraint
      - `nom` (text) — company name
      - `adresse` (text) — company address
      - `telephone` (text) — phone number
      - `logo_url` (text, nullable) — public URL of uploaded logo
      - `updated_at` (timestamptz) — last update timestamp

  2. Storage
    - Bucket `logos` (public) for logo files (png/pdf)

  3. Security
    - Enable RLS on `entreprise`
    - Authenticated users can select and upsert
*/

CREATE TABLE IF NOT EXISTS entreprise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL DEFAULT '',
  adresse text NOT NULL DEFAULT '',
  telephone text NOT NULL DEFAULT '',
  logo_url text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE entreprise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read entreprise"
  ON entreprise FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert entreprise"
  ON entreprise FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update entreprise"
  ON entreprise FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Public can read logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
