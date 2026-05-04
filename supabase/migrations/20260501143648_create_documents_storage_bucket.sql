/*
  # Create documents Storage bucket

  1. New Storage bucket
    - `documents` — public bucket for PDF uploads (evacuation plans etc.)

  2. Storage Policies
    - SELECT (read): any authenticated user who is Direction or super admin
    - INSERT (upload): Direction or super admin only
    - DELETE: Direction or super admin only
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow Direction / super admins to upload
CREATE POLICY "Direction and super admins can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND is_direction_or_super_admin()
  );

-- Allow Direction / super admins to delete
CREATE POLICY "Direction and super admins can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND is_direction_or_super_admin()
  );

-- Allow Direction / super admins to read documents
CREATE POLICY "Direction and super admins can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND is_direction_or_super_admin()
  );
