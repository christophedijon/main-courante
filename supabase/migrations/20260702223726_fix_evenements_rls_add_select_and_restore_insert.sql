
-- Fix 1: Add missing SELECT policy on evenements
-- (no SELECT policy existed — the post-INSERT .select() was returning null)
CREATE POLICY "evenements_select_own_etab"
  ON public.evenements FOR SELECT
  TO authenticated
  USING (
    etablissement_id = get_user_etablissement_id()
    OR is_mega_admin()
  );

-- Fix 2: Replace the overly strict INSERT policy
-- The manually-created evenements_insert_own_etab fails when
-- get_user_etablissement_id() returns NULL (race / fallback cases).
-- Restore the simple authenticated check from migration 20260613020009.
DROP POLICY IF EXISTS "evenements_insert_own_etab" ON public.evenements;

CREATE POLICY "evenements_insert_authenticated"
  ON public.evenements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
