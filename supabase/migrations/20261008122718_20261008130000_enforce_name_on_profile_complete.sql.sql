/*
# Enforce first_name and last_name on profile completion

## Purpose
Prevents a managed_users row from being marked profile_completed = true
if the corresponding user_profiles row has an empty first_name or last_name.
This is the server-side enforcement of the "Prénom et Nom obligatoires" rule.

## How it works
A BEFORE UPDATE trigger on managed_users checks that, when profile_completed
is being set to true, the user_profiles row for auth_user_id has non-empty
first_name AND last_name. If either is empty, the update is blocked with an error.

## Security
- The trigger runs for all updates (including via service role), ensuring
  no code path can bypass the requirement.
- The function is SECURITY DEFINER to read user_profiles regardless of RLS.
- No new tables or columns.
*/

CREATE OR REPLACE FUNCTION public.check_profile_name_before_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
BEGIN
  -- Only check when profile_completed is being set to true
  IF NEW.profile_completed = true AND (OLD.profile_completed IS NULL OR OLD.profile_completed = false) THEN
    SELECT first_name, last_name
    INTO v_first_name, v_last_name
    FROM public.user_profiles
    WHERE id = NEW.auth_user_id;

    IF v_first_name IS NULL OR TRIM(v_first_name) = '' OR v_last_name IS NULL OR TRIM(v_last_name) = '' THEN
      RAISE EXCEPTION 'Profil incomplet: le prénom et le nom sont obligatoires pour valider le profil.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_profile_name_before_complete ON public.managed_users;
CREATE TRIGGER trg_check_profile_name_before_complete
  BEFORE UPDATE OF profile_completed ON public.managed_users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_name_before_complete();
