/*
  # Create carte_sejour storage bucket

  1. Storage
    - New bucket `carte-sejour` (private, authenticated access)
    - Users can only upload/view/delete their own files (path prefixed by their user id)

  2. Security
    - SELECT: owner of the file (path starts with auth.uid())
    - INSERT: authenticated user uploading under their own uid prefix
    - DELETE: owner of the file
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('carte-sejour', 'carte-sejour', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files under their own user-id prefix
CREATE POLICY "Users can upload their own carte sejour photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'carte-sejour'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to view their own files
CREATE POLICY "Users can view their own carte sejour photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'carte-sejour'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own carte sejour photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'carte-sejour'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow super admins and direction to view all carte sejour photos
CREATE POLICY "Admins can view all carte sejour photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'carte-sejour'
    AND is_direction_or_super_admin()
  );
