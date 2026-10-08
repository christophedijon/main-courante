/*
# Fix storage bucket isolation — scope by etablissement_id folder prefix

## Problem
Storage SELECT policies on `documents`, `registre-securite`, `media-evenements`,
and `logos` only check `bucket_id` without folder-level filtering. Any authenticated
user can list ALL files across ALL establishments. Similarly, INSERT policies on
`documents`, `logos`, and `media-evenements` allow uploading to ANY folder.

## Fix
Add folder-level isolation using `(storage.foldername(name))[1]` compared against
the caller's etablissement_id (via `get_user_etablissement_id()`):

- **documents**: SELECT/INSERT/DELETE scoped to `{etab_id}/` folder prefix.
  SuperAdmin bypasses via `is_super_admin()`.
- **registre-securite**: SELECT/INSERT/DELETE scoped to registre_id folders that
  belong to the caller's etab via EXISTS subquery on registre_securite.
- **media-evenements**: INSERT/DELETE scoped to caller's etab_id folder. SELECT stays public.
- **logos**: INSERT/DELETE/UPDATE scoped to `{etab_id}/` folder. SELECT stays public.

## Impact
- No legitimate access broken: users can still read/write their own etab's files.
- SuperAdmin still has full access.
*/

-- =====================================================================
-- documents bucket: scope by etab_id folder
-- =====================================================================

DROP POLICY IF EXISTS "Direction and super admins can read documents" ON storage.objects;
CREATE POLICY "Direction can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

DROP POLICY IF EXISTS "Direction and super admins can upload documents" ON storage.objects;
CREATE POLICY "Direction can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

DROP POLICY IF EXISTS "Direction and super admins can delete documents" ON storage.objects;
CREATE POLICY "Direction can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

-- =====================================================================
-- registre-securite bucket: scope by registre_id that belongs to caller's etab
-- =====================================================================

DROP POLICY IF EXISTS "registre_securite_storage_select" ON storage.objects;
CREATE POLICY "registre_securite_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'registre-securite'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM registre_securite rs
        WHERE rs.id::text = (storage.foldername(name))[1]
        AND rs.etablissement_id = get_user_etablissement_id()
      )
    )
  )
);

DROP POLICY IF EXISTS "registre_securite_storage_insert" ON storage.objects;
CREATE POLICY "registre_securite_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'registre-securite'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM registre_securite rs
        WHERE rs.id::text = (storage.foldername(name))[1]
        AND rs.etablissement_id = get_user_etablissement_id()
      )
    )
  )
);

DROP POLICY IF EXISTS "registre_securite_storage_delete" ON storage.objects;
CREATE POLICY "registre_securite_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'registre-securite'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM registre_securite rs
        WHERE rs.id::text = (storage.foldername(name))[1]
        AND rs.etablissement_id = get_user_etablissement_id()
      )
    )
  )
);

DROP POLICY IF EXISTS "registre_securite_storage_update" ON storage.objects;
CREATE POLICY "registre_securite_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'registre-securite'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM registre_securite rs
        WHERE rs.id::text = (storage.foldername(name))[1]
        AND rs.etablissement_id = get_user_etablissement_id()
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'registre-securite'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM registre_securite rs
        WHERE rs.id::text = (storage.foldername(name))[1]
        AND rs.etablissement_id = get_user_etablissement_id()
      )
    )
  )
);

-- =====================================================================
-- media-evenements bucket: scope INSERT/DELETE by etab_id folder
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Users can upload media to own etab"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-evenements'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
CREATE POLICY "Users can delete own etab media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media-evenements'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

-- =====================================================================
-- logos bucket: scope INSERT/DELETE/UPDATE by etab_id folder
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Users can upload own logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Users can delete own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Users can update own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);
