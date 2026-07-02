-- registre-securite: make private + require authentication for all operations.
-- The 4 existing policies had no role check (accessible by anon) — critical fix.
UPDATE storage.buckets SET public = false WHERE name = 'registre-securite';

DROP POLICY IF EXISTS "registre_securite_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "registre_securite_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "registre_securite_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "registre_securite_storage_delete" ON storage.objects;

CREATE POLICY "registre_securite_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'registre-securite');

CREATE POLICY "registre_securite_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'registre-securite');

CREATE POLICY "registre_securite_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'registre-securite')
  WITH CHECK (bucket_id = 'registre-securite');

CREATE POLICY "registre_securite_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'registre-securite');

-- documents-media and media-evenements: keep buckets public (direct URL access works),
-- but restrict SELECT policy to authenticated to prevent unauthenticated listing.
DROP POLICY IF EXISTS "Public can read documents media" ON storage.objects;
CREATE POLICY "Public can read documents media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents-media');

DROP POLICY IF EXISTS "Anyone can read media" ON storage.objects;
CREATE POLICY "Anyone can read media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'media-evenements');
