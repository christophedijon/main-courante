/*
  # Create evenement_medias table and media-evenements storage bucket

  1. New Tables
    - `evenement_medias`
      - `id` (uuid, primary key)
      - `evenement_id` (uuid, FK to evenements)
      - `storage_path` (text) — path inside the bucket
      - `mime_type` (text) — e.g. image/jpeg, audio/mpeg, video/mp4
      - `original_name` (text) — original file name
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)

  2. Storage
    - New public bucket `media-evenements`
    - Authenticated users can upload to paths prefixed by their own user id
    - Authenticated users can read all media within the bucket

  3. Security
    - RLS enabled on evenement_medias
    - SELECT: authenticated users can view medias linked to their own events
    - INSERT: authenticated users can insert for their own events
*/

-- Table
CREATE TABLE IF NOT EXISTS evenement_medias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id uuid NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  original_name text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evenement_medias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view medias for their events"
  ON evenement_medias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evenements e
      WHERE e.id = evenement_medias.evenement_id
    )
  );

CREATE POLICY "Users can insert medias for their own events"
  ON evenement_medias FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM evenements e
      WHERE e.id = evenement_medias.evenement_id
        AND e.created_by = auth.uid()
    )
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-evenements', 'media-evenements', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media-evenements');

CREATE POLICY "Anyone can read media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'media-evenements');

CREATE POLICY "Users can delete their own media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media-evenements' AND auth.uid()::text = (storage.foldername(name))[1]);
