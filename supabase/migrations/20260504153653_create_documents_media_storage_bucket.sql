/*
  # Create documents-media storage bucket

  Creates a public Supabase Storage bucket for images and PDFs
  attached to toolbox documents (back-office rich editor uploads).

  - Bucket name: documents-media
  - Public: true (so mobile can read files without signed URLs)
  - Allowed mime types: images and PDF
  - Max file size: 5MB
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents-media',
  'documents-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Super admins can upload/delete
CREATE POLICY "Super admins can upload documents media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents-media'
    AND EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Super admins can delete documents media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents-media'
    AND EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (auth.jwt() ->> 'email')
    )
  );

-- Everyone can read (public bucket, but explicit policy for clarity)
CREATE POLICY "Public can read documents media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents-media');
