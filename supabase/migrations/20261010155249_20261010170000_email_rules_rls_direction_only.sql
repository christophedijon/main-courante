/*
# Restrict email_rules RLS to Direction + SuperAdmin + MegaAdmin only

## Purpose
Previously, any authenticated user belonging to an establishment (agents, chefs de poste, serveurs)
could read, modify, and delete email_rules for their establishment. This migration restricts
access to Direction users, SuperAdmins, and MegaAdmins only.

## Changes
1. New helper function `is_direction_of_etab(target_etab_id uuid)` — SECURITY DEFINER,
   search_path fixed to public. Returns true if the calling user has fonction = 'Direction'
   in managed_users for the given establishment, OR is a super_admin/mega_admin.
2. Replaces all 5 existing email_rules policies with Direction-only versions.
3. Revokes EXECUTE on the helper function from anon and authenticated (it's only used
   internally by RLS policies, not called directly by the app).

## Security
- SELECT: only Direction of the establishment, SuperAdmin, or MegaAdmin.
- INSERT/UPDATE/DELETE: same restriction.
- The `email_rules_isolation` policy (FOR ALL) is dropped and replaced by per-verb policies.
- Edge functions use the service_role key which bypasses RLS — unaffected.
- BackupPage reads email_rules with the user's session — Direction users can still export.
  Agents/serveurs will no longer see email_rules in the backup (they couldn't meaningfully
  use it anyway).

## What breaks
- EmailsPage: agents, chefs de poste, and serveurs will get empty results from the
  email_rules query and won't be able to save changes. The page should already be
  gated to Direction in the UI; if not, a UI gate should be added separately.
- BackupPage: the email_rules section of the backup will be empty for non-Direction users.
  This is acceptable — the backup feature is used by Direction.
*/

-- ============================================================
-- 1. Helper function: is_direction_of_etab
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_direction_of_etab(target_etab_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(
      public.is_super_admin(),
      public.is_mega_admin(),
      EXISTS (
        SELECT 1 FROM managed_users mu
        WHERE mu.auth_user_id = auth.uid()
        AND mu.etablissement_id = target_etab_id
        AND mu.fonction = 'Direction'
      )
    )
$$;

-- Revoke direct execution from anon and authenticated — only used by RLS policies
REVOKE EXECUTE ON FUNCTION public.is_direction_of_etab(uuid) FROM anon, authenticated;

-- ============================================================
-- 2. Drop all existing email_rules policies
-- ============================================================
DROP POLICY IF EXISTS "email_rules_select_own_etab" ON email_rules;
DROP POLICY IF EXISTS "email_rules_insert_own_etab" ON email_rules;
DROP POLICY IF EXISTS "email_rules_update_own_etab" ON email_rules;
DROP POLICY IF EXISTS "email_rules_delete_own_etab" ON email_rules;
DROP POLICY IF EXISTS "email_rules_isolation" ON email_rules;

-- ============================================================
-- 3. Create new Direction-only policies
-- ============================================================
CREATE POLICY "email_rules_select_direction"
  ON email_rules FOR SELECT
  TO authenticated
  USING (public.is_direction_of_etab(etablissement_id));

CREATE POLICY "email_rules_insert_direction"
  ON email_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_direction_of_etab(etablissement_id));

CREATE POLICY "email_rules_update_direction"
  ON email_rules FOR UPDATE
  TO authenticated
  USING (public.is_direction_of_etab(etablissement_id))
  WITH CHECK (public.is_direction_of_etab(etablissement_id));

CREATE POLICY "email_rules_delete_direction"
  ON email_rules FOR DELETE
  TO authenticated
  USING (public.is_direction_of_etab(etablissement_id));
