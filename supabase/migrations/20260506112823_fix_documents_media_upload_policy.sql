/*
  # Fix documents-media storage upload policy

  ## Problem
  The INSERT policy on storage.objects for the 'documents-media' bucket
  was restricted to super_admins only, preventing regular authenticated
  users (agents, direction, etc.) from uploading images and PDFs via
  the RichEditor component.

  ## Changes
  - DROP the restrictive super-admin-only INSERT policy
  - CREATE a new INSERT policy allowing all authenticated users to upload
  - The DELETE policy is also extended to all authenticated users
    so they can manage their own uploads

  ## Security
  - SELECT (read) remains public (files are served publicly via URL)
  - INSERT is now open to all authenticated users
  - DELETE is now open to all authenticated users
*/

DROP POLICY IF EXISTS "Super admins can upload documents media" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete documents media" ON storage.objects;

CREATE POLICY "Authenticated users can upload documents media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents-media');

CREATE POLICY "Authenticated users can delete documents media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents-media');
