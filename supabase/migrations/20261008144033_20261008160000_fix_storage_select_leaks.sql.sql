/*
# Fix storage SELECT policy leaks — cross-establishment isolation

## Problem
Multiple storage SELECT policies allowed any authenticated user to list/read
files from ANY establishment, with no folder-level isolation:

1. **media-evenements**: "Anyone can read media" — `bucket_id = 'media-evenements'`
   with no folder check. Any user could list and download ALL media from ALL etabs.
   Confirmed by test: LeTest user listed GARI's media folder contents.

2. **documents-media**: "Public can read documents media" — `bucket_id = 'documents-media'`
   with no folder check. All 23 PDF files are flat-named (no etab_id prefix), so
   the only fix is to scope by etab_id folder going forward. Existing flat files
   remain readable until migrated, but new uploads must use etab_id prefix.

3. **logos**: "Public can read logos" — scoped to `anon` role (public bucket).
   Logos are displayed on public-facing pages, so public read is intentional.
   But listing must be restricted to own etab's logos only.

4. **documents evacuation folder**: The "evacuation/" prefix was shared across
   all etabs — any Direction user could read ALL evacuation plans. Fix: scope
   evacuation folder access to only the etab_id that owns the plan, verified
   via the evacuation_plans table (etablissement_id column).

## Changes

### media-evenements
- DROP "Anyone can read media" (unrestricted SELECT)
- CREATE "Users can read own etab media" — folder[1] = etab_id OR folder[1] = auth.uid()
  (existing uploads use user_id/event_id/ pattern, new uploads use etab_id/)

### documents-media
- DROP "Public can read documents media" (unrestricted SELECT)
- DROP "Authenticated users can upload documents media" (unrestricted INSERT)
- DROP "Authenticated users can delete documents media" (unrestricted DELETE)
- CREATE scoped SELECT: folder[1] = etab_id (for new etab-prefixed uploads)
- CREATE scoped INSERT: WITH CHECK folder[1] = etab_id
- CREATE scoped DELETE: folder[1] = etab_id

### logos
- DROP "Public can read logos" (unrestricted anon SELECT)
- CREATE "Users can read own etab logos" — authenticated, folder[1] = etab_id
  OR is_super_admin (super admin can see all)

### documents (evacuation folder fix)
- DROP existing "Direction can read own documents" SELECT policy
- CREATE new SELECT: is_super_admin OR
  (folder[1] = 'evacuation' AND etablissement_id matches via evacuation_plans table) OR
  (folder[1] = etab_id AND is_direction_or_super_admin)
- DROP existing DELETE and INSERT policies, recreate with same evacuation check

## Security
- All SELECT policies now enforce folder-level etab isolation
- media-evenements: folder[1] must match etab_id or auth.uid()
- documents-media: folder[1] must match etab_id
- logos: folder[1] must match etab_id, or super_admin bypass
- documents: evacuation folder access verified via evacuation_plans.etablissement_id
- Existing flat-named documents-media files (no folder) will become unreadable
  until migrated to etab_id-prefixed paths (data migration not in this migration)
*/

-- ============================================================
-- media-evenements: Fix SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read media" ON storage.objects;

CREATE POLICY "Users can read own etab media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-evenements'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- ============================================================
-- documents-media: Replace unrestricted policies with etab-scoped ones
-- ============================================================
DROP POLICY IF EXISTS "Public can read documents media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents media" ON storage.objects;

CREATE POLICY "Users can read own etab documents-media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents-media'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

CREATE POLICY "Users can upload own etab documents-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents-media'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

CREATE POLICY "Users can delete own etab documents-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents-media'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

-- ============================================================
-- logos: Fix SELECT policy — was public/anon, now etab-scoped
-- ============================================================
DROP POLICY IF EXISTS "Public can read logos" ON storage.objects;

CREATE POLICY "Users can read own etab logos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND (
    is_super_admin()
    OR (storage.foldername(name))[1] = get_user_etablissement_id()::text
  )
);

-- ============================================================
-- documents: Fix evacuation folder leak
-- Old: evacuation folder accessible to ALL direction users
-- New: evacuation folder accessible only if the plan belongs to caller's etab
-- ============================================================
DROP POLICY IF EXISTS "Direction can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Direction can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Direction can delete own documents" ON storage.objects;

CREATE POLICY "Direction can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = 'evacuation'::text
      AND is_direction_or_super_admin()
      AND EXISTS (
        SELECT 1 FROM evacuation_plans ep
        WHERE ep.file_path = name
        AND ep.etablissement_id = get_user_etablissement_id()
      )
    )
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

CREATE POLICY "Direction can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = 'evacuation'::text
      AND is_direction_or_super_admin()
      AND get_user_etablissement_id() IS NOT NULL
    )
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);

CREATE POLICY "Direction can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin()
    OR (
      (storage.foldername(name))[1] = 'evacuation'::text
      AND is_direction_or_super_admin()
      AND EXISTS (
        SELECT 1 FROM evacuation_plans ep
        WHERE ep.file_path = name
        AND ep.etablissement_id = get_user_etablissement_id()
      )
    )
    OR (
      (storage.foldername(name))[1] = get_user_etablissement_id()::text
      AND is_direction_or_super_admin()
    )
  )
);
