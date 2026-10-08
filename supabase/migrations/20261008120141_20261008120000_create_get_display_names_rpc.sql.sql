/*
# Create get_display_names RPC for user name resolution

## Purpose
Allows any authenticated user to resolve "Prénom Nom" display names for users
in their own establishment, without needing read access to user_profiles
(which is restricted to managers).

## How it works
1. The caller provides an array of auth user UUIDs (e.g. from evenements.created_by).
2. The function looks up each UUID in managed_users to find the etablissement_id
   and email, then joins user_profiles for first_name / last_name.
3. It returns ONLY rows where the user belongs to the SAME etablissement as the caller.
4. For each UUID, it returns: auth_user_id, display_name ("Prénom Nom" or email fallback),
   and fonction.
5. No sensitive data (carte pro, nationality, phone, etc.) is exposed.

## Security
- SECURITY DEFINER: runs with elevated privileges to read managed_users + user_profiles.
- Isolation: only returns names for users in the caller's establishment.
- The caller's etablissement is resolved via managed_users.auth_user_id = auth.uid().
- SuperAdmin (no etablissement) gets all names (they manage all clients).
- EXECUTE granted to authenticated role only.

## Tables
- No new tables. Reads from: managed_users, user_profiles.
*/

-- Helper: resolve a batch of auth user IDs to display names, scoped by etablissement
CREATE OR REPLACE FUNCTION public.get_display_names(p_auth_ids uuid[])
RETURNS TABLE (
  auth_user_id uuid,
  display_name text,
  fonction text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_etab_id uuid;
  v_is_super_admin boolean;
BEGIN
  -- Determine the caller's etablissement
  SELECT mu.etablissement_id, COALESCE(mu.is_super_admin, false)
  INTO v_caller_etab_id, v_is_super_admin
  FROM public.managed_users mu
  WHERE mu.auth_user_id = auth.uid()
  LIMIT 1;

  -- If caller not found in managed_users, return nothing
  IF v_caller_etab_id IS NULL AND v_is_super_admin IS false THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    mu.auth_user_id,
    CASE
      WHEN up.first_name IS NOT NULL AND up.first_name <> ''
        AND up.last_name IS NOT NULL AND up.last_name <> ''
        THEN TRIM(up.first_name || ' ' || up.last_name)
      WHEN up.first_name IS NOT NULL AND up.first_name <> ''
        THEN up.first_name
      WHEN up.last_name IS NOT NULL AND up.last_name <> ''
        THEN up.last_name
      ELSE mu.email
    END AS display_name,
    mu.fonction
  FROM public.managed_users mu
  LEFT JOIN public.user_profiles up ON up.id = mu.auth_user_id
  WHERE mu.auth_user_id = ANY(p_auth_ids)
    AND (
      v_is_super_admin = true
      OR mu.etablissement_id = v_caller_etab_id
    );
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.get_display_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_display_names(uuid[]) TO authenticated;
