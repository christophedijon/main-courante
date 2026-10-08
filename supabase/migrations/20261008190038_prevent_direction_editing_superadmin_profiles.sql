/*
# Prevent Direction from modifying SuperAdmin profiles

## Context
The user requested that Direction cannot modify SuperAdmin profiles.
Currently is_direction_of_user returns true for any user in the same establishment,
including SuperAdmins. This adds a check to exclude SuperAdmin targets.

## Changes
1. Recreate is_direction_of_user with NOT target.is_super_admin = true condition
2. Drop/recreate dependent write policies on user_profiles and user_formations

## Security
- Direction can still READ SuperAdmin profiles (via is_manager_of_user) if in same establishment
- Direction CANNOT write (INSERT/UPDATE/DELETE) SuperAdmin profiles or formations
- SuperAdmin rights are untouched — is_super_admin() still grants full access
*/

-- Drop dependent write policies
DROP POLICY IF EXISTS "Direction can update team profiles" ON user_profiles;
DROP POLICY IF EXISTS "Direction can insert team profiles" ON user_profiles;
DROP POLICY IF EXISTS "Direction can update team formations" ON user_formations;
DROP POLICY IF EXISTS "Direction can insert team formations" ON user_formations;
DROP POLICY IF EXISTS "Direction can delete team formations" ON user_formations;

-- Recreate is_direction_of_user with SuperAdmin exclusion
DROP FUNCTION IF EXISTS public.is_direction_of_user(uuid);
CREATE FUNCTION public.is_direction_of_user(p_target_auth_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM managed_users viewer
    JOIN managed_users target ON target.auth_user_id = p_target_auth_user_id
    WHERE viewer.auth_user_id = auth.uid()
    AND viewer.etablissement_id = target.etablissement_id
    AND viewer.etablissement_id IS NOT NULL
    AND viewer.fonction = 'Direction'
    AND NOT (target.is_super_admin = true)
  );
$$;

-- Recreate write policies
CREATE POLICY "Direction can update team profiles"
ON user_profiles FOR UPDATE
TO authenticated
USING (is_direction_of_user(id))
WITH CHECK (is_direction_of_user(id));

CREATE POLICY "Direction can insert team profiles"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (is_direction_of_user(id));

CREATE POLICY "Direction can update team formations"
ON user_formations FOR UPDATE
TO authenticated
USING (is_direction_of_user(user_id))
WITH CHECK (is_direction_of_user(user_id));

CREATE POLICY "Direction can insert team formations"
ON user_formations FOR INSERT
TO authenticated
WITH CHECK (is_direction_of_user(user_id));

CREATE POLICY "Direction can delete team formations"
ON user_formations FOR DELETE
TO authenticated
USING (is_direction_of_user(user_id));
