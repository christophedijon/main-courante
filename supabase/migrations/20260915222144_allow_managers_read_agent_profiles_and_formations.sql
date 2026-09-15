/*
# Allow Direction / Chef de poste to read agent profiles and formations

## Context
The "Carte PRO" mobile page lets a Direction or Chef de poste user browse a
list of agents in their establishment and open a read-only professional card
for any agent. However, the RLS policies on `user_profiles` and
`user_formations` only allow reading your own row (`auth.uid() = id`) plus a
mega-admin exception. A Direction user querying another agent's profile gets
empty results — the card shows blank nationality, CNAPS number, and formations.

## Changes

### New helper function
- `is_manager_of_user(target_user_id uuid)` — returns true if the current
  authenticated user is a Direction or Chef de poste in the same establishment
  as the target user. Uses the existing `managed_users` table to resolve both
  users' establishment and fonction.

### RLS policy changes
- `user_profiles`: add SELECT policy "Managers can read team profiles" allowing
  Direction / Chef de poste to SELECT any profile belonging to an agent in the
  same establishment.
- `user_formations`: add SELECT policy "Managers can read team formations"
  allowing the same access for formation rows.

These are SELECT-only policies — managers cannot modify another agent's
profile or formations through these policies. Write access remains
owner-scoped as before.
*/

-- ── Helper: is the current user a manager of the target user? ───────────────
CREATE OR REPLACE FUNCTION public.is_manager_of_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM managed_users viewer
    JOIN managed_users target ON target.auth_user_id = $1
    WHERE viewer.auth_user_id = auth.uid()
      AND viewer.etablissement_id = target.etablissement_id
      AND viewer.etablissement_id IS NOT NULL
      AND viewer.fonction IN ('Direction', 'Chef de poste')
  );
$function$;

-- ── user_profiles: managers can read team profiles ──────────────────────────
DROP POLICY IF EXISTS "Managers can read team profiles" ON user_profiles;
CREATE POLICY "Managers can read team profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (public.is_manager_of_user(id));

-- ── user_formations: managers can read team formations ──────────────────────
DROP POLICY IF EXISTS "Managers can read team formations" ON user_formations;
CREATE POLICY "Managers can read team formations"
  ON user_formations FOR SELECT
  TO authenticated
  USING (public.is_manager_of_user(user_id));
