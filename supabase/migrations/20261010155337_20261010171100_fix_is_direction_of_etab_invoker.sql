/*
# Fix is_direction_of_etab: use SECURITY INVOKER

The SECURITY DEFINER version failed because auth.uid() context doesn't
propagate correctly inside a SECURITY DEFINER function in this environment.
Switch to SECURITY INVOKER so the function executes with the caller's
permissions and auth context. RLS on managed_users allows authenticated
users to read their own managed_users row, so the EXISTS subquery works.

Steps:
1. Drop all 4 email_rules policies (they depend on the function)
2. Drop and recreate the function as SECURITY INVOKER
3. Recreate the 4 policies
*/

-- 1. Drop policies
DROP POLICY IF EXISTS "email_rules_select_direction" ON email_rules;
DROP POLICY IF EXISTS "email_rules_insert_direction" ON email_rules;
DROP POLICY IF EXISTS "email_rules_update_direction" ON email_rules;
DROP POLICY IF EXISTS "email_rules_delete_direction" ON email_rules;

-- 2. Recreate function as SECURITY INVOKER
DROP FUNCTION IF EXISTS public.is_direction_of_etab(uuid);

CREATE OR REPLACE FUNCTION public.is_direction_of_etab(target_etab_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
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

-- Revoke direct execution from anon — only used by RLS policies
REVOKE EXECUTE ON FUNCTION public.is_direction_of_etab(uuid) FROM anon;

-- 3. Recreate policies
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
