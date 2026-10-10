/*
# Fix is_direction_of_etab: COALESCE vs OR bug

## Problem
The function used COALESCE(is_super_admin(), is_mega_admin(), EXISTS(...)).
COALESCE only skips NULL values, not FALSE. Since is_super_admin() returns
false (not null), COALESCE returns false immediately and never evaluates
the EXISTS subquery that checks managed_users for Direction role.

## Fix
1. Drop the 4 email_rules policies that depend on the function.
2. Replace function with OR logic (not COALESCE).
3. Recreate the 4 policies.

## Security
The function remains SECURITY INVOKER, STABLE, search_path=public.
Policies are unchanged from the previous migration — same Direction-only scope.
*/

-- Step 1: Drop policies that depend on the function
DROP POLICY IF EXISTS "email_rules_select_direction" ON email_rules;
DROP POLICY IF EXISTS "email_rules_insert_direction" ON email_rules;
DROP POLICY IF EXISTS "email_rules_update_direction" ON email_rules;
DROP POLICY IF EXISTS "email_rules_delete_direction" ON email_rules;

-- Step 2: Fix the function (OR instead of COALESCE)
CREATE OR REPLACE FUNCTION public.is_direction_of_etab(target_etab_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin()
    OR public.is_mega_admin()
    OR EXISTS (
      SELECT 1 FROM managed_users mu
      WHERE mu.auth_user_id = auth.uid()
      AND mu.etablissement_id = target_etab_id
      AND mu.fonction = 'Direction'
    )
$$;

-- Step 3: Recreate the policies
CREATE POLICY "email_rules_select_direction" ON email_rules
  FOR SELECT TO authenticated
  USING (public.is_direction_of_etab(etablissement_id));

CREATE POLICY "email_rules_insert_direction" ON email_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_direction_of_etab(etablissement_id));

CREATE POLICY "email_rules_update_direction" ON email_rules
  FOR UPDATE TO authenticated
  USING (public.is_direction_of_etab(etablissement_id))
  WITH CHECK (public.is_direction_of_etab(etablissement_id));

CREATE POLICY "email_rules_delete_direction" ON email_rules
  FOR DELETE TO authenticated
  USING (public.is_direction_of_etab(etablissement_id));
