/*
# Allow Direction to update/insert user_profiles and user_formations of their establishment

## Context
A Direction user editing an agent's profile (UserEditPage) gets "Erreur lors de la sauvegarde"
because RLS on user_profiles only allows self-update (auth.uid() = id) or super_admin.
Managers (Direction) can READ team profiles but cannot WRITE them.

Similarly, user_formations only allows self-write or super_admin — Direction cannot add
formations for their agents.

## Changes

### 1. New function: is_direction_of_user(target_auth_user_id uuid)
Returns true if the current user is a 'Direction' in the same establishment as the target user.
Unlike is_manager_of_user (which allows Chef de poste), this is restricted to Direction only.
This respects the hierarchy: Direction can edit agent profiles, Chef de poste cannot.

### 2. user_profiles: add UPDATE policy for Direction
Allows a Direction to UPDATE user_profiles rows of users in their establishment.
WITH CHECK ensures the Direction cannot move the profile to a different user (id stays the same).

### 3. user_profiles: add INSERT policy for Direction
Allows a Direction to INSERT user_profiles for users in their establishment.
Needed because the frontend uses upsert (INSERT ... ON CONFLICT DO UPDATE).

### 4. user_formations: add INSERT/UPDATE/DELETE policies for Direction
Allows a Direction to add/edit/delete formations for users in their establishment.

### 5. Restrict is_manager_of_user to Direction only (was Direction + Chef de poste)
Chef de poste should not be able to read or modify other agents' profiles.
Only Direction can manage their team.

## Security
- Direction can only modify profiles of users in THEIR establishment (enforced by is_direction_of_user)
- Chef de poste can only read/edit their own profile
- Cross-establishment access is denied
- A Direction cannot modify another Direction's profile (same establishment but different role — the policy allows it for same-establishment, which is acceptable since Direction is the establishment admin)
- No changes to super_admin access
*/
