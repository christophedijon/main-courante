/*
# Adjust storage isolation — handle existing folder patterns

## Problem
The previous migration required (storage.foldername(name))[1] = etab_id for
documents and media-evenements. But:
- documents bucket uses 'evacuation/' as folder for evacuation plans
- media-evenements uses user_id as first folder segment (not etab_id)

## Fix
- documents: allow 'evacuation' folder OR etab_id folder
- media-evenements: allow user_id (auth.uid()) OR etab_id as first folder
*/

-- =====================================================================
-- documents: allow evacuation folder OR etab_id folder
-- =====================================================================

DROP POLICY IF EXISTS "Direction can read own documents" ON storage.objects;
CREATE POLICY "Direction can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = 'evacuation'
      AND is_direction_or_super_admin()
    )
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

DROP POLICY IF EXISTS "Direction can upload own documents" ON storage.objects;
CREATE POLICY "Direction can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = 'evacuation'
      AND is_direction_or_super_admin()
    )
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

DROP POLICY IF EXISTS "Direction can delete own documents" ON storage.objects;
CREATE POLICY "Direction can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = 'evacuation'
      AND is_direction_or_super_admin()
    )
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

-- =====================================================================
-- media-evenements: allow user_id OR etab_id as first folder
-- =====================================================================

DROP POLICY IF EXISTS "Users can upload media to own etab" ON storage.objects;
CREATE POLICY "Users can upload media to own etab"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-evenements'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Users can delete own etab media" ON storage.objects;
CREATE POLICY "Users can delete own etab media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media-evenements'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
