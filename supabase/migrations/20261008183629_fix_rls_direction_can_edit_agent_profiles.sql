/*
# Allow Direction to update/insert user_profiles and user_formations of their establishment

## Context
A Direction editing an agent's profile gets "Erreur lors de la sauvegarde" because RLS on
user_profiles only allows self-update or super_admin. Direction can READ team profiles but
cannot WRITE them. Same issue on user_formations.

## Changes
1. New function is_direction_of_user — Direction only, same establishment
2. Recreate is_manager_of_user restricted to Direction only (was Direction + Chef de poste)
3. user_profiles: UPDATE + INSERT policies for Direction
4. user_formations: INSERT + UPDATE + DELETE policies for Direction
5. Recreate dependent read policies after function recreation

## Security
- Direction can only modify profiles of users in THEIR establishment
- Chef de poste can only read/edit their own profile (no longer reads other agents)
- Cross-establishment access is denied
*/

-- 1. Creer is_direction_of_user
CREATE OR REPLACE FUNCTION public.is_direction_of_user(p_target_auth_user_id uuid)
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
  );
$$;

-- 2. Drop dependent policies before recreating the function
DROP POLICY IF EXISTS "Managers can read team profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can read team formations" ON user_formations;

-- 3. Recreate is_manager_of_user restricted to Direction only
DROP FUNCTION IF EXISTS public.is_manager_of_user(uuid);
CREATE FUNCTION public.is_manager_of_user(p_target_auth_user_id uuid)
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
  );
$$;

-- 4. Recreate the read policies with the new function
CREATE POLICY "Managers can read team profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (is_manager_of_user(id));

CREATE POLICY "Managers can read team formations"
ON user_formations FOR SELECT
TO authenticated
USING (is_manager_of_user(user_id));

-- 5. user_profiles: Direction can UPDATE profiles of their establishment's users
DROP POLICY IF EXISTS "Direction can update team profiles" ON user_profiles;
CREATE POLICY "Direction can update team profiles"
ON user_profiles FOR UPDATE
TO authenticated
USING (is_direction_of_user(id))
WITH CHECK (is_direction_of_user(id));

-- 6. user_profiles: Direction can INSERT profiles for their establishment's users
DROP POLICY IF EXISTS "Direction can insert team profiles" ON user_profiles;
CREATE POLICY "Direction can insert team profiles"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (is_direction_of_user(id));

-- 7. user_formations: Direction can INSERT formations for their establishment's users
DROP POLICY IF EXISTS "Direction can insert team formations" ON user_formations;
CREATE POLICY "Direction can insert team formations"
ON user_formations FOR INSERT
TO authenticated
WITH CHECK (is_direction_of_user(user_id));

-- 8. user_formations: Direction can UPDATE formations for their establishment's users
DROP POLICY IF EXISTS "Direction can update team formations" ON user_formations;
CREATE POLICY "Direction can update team formations"
ON user_formations FOR UPDATE
TO authenticated
USING (is_direction_of_user(user_id))
WITH CHECK (is_direction_of_user(user_id));

-- 9. user_formations: Direction can DELETE formations for their establishment's users
DROP POLICY IF EXISTS "Direction can delete team formations" ON user_formations;
CREATE POLICY "Direction can delete team formations"
ON user_formations FOR DELETE
TO authenticated
USING (is_direction_of_user(user_id));
