/*
# Restore Chef de poste read access on user_profiles and user_formations

## Context
The previous migration (fix_rls_direction_can_edit_agent_profiles) restricted is_manager_of_user
to Direction only, removing Chef de poste read access. The requirement is:
- READ: Direction AND Chef de poste can read profiles/formations of their establishment
- WRITE: Direction only (is_direction_of_user, already in place)

## Changes
1. Recreate is_manager_of_user to allow Direction AND Chef de poste (read-only purpose)
2. No policy changes needed — read policies already use is_manager_of_user

## Security
- is_manager_of_user is used ONLY in SELECT (read) policies
- is_direction_of_user is used in INSERT/UPDATE/DELETE (write) policies
- Chef de poste gets read access back but cannot write (no write policy uses is_manager_of_user)
*/

-- Drop dependent policies first
DROP POLICY IF EXISTS "Managers can read team profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can read team formations" ON user_formations;

-- Recreate is_manager_of_user allowing Direction + Chef de poste (for READ only)
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
    AND viewer.fonction IN ('Direction', 'Chef de poste')
  );
$$;

-- Recreate read policies
CREATE POLICY "Managers can read team profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (is_manager_of_user(id));

CREATE POLICY "Managers can read team formations"
ON user_formations FOR SELECT
TO authenticated
USING (is_manager_of_user(user_id));
