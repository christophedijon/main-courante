/*
# Fix close_test_session: add ownership guard

## Context
close_test_session had NO authorization check in its body. Any authenticated user
could pass any etablissement_id and delete that etablissement's test jauge data +
reset its forced session. The other 4 jauge RPCs (increment_jauge, reset_jauge,
set_entrees_manuelles, sync_jauge_zapsis) all have an ownership guard; this one
was missing it.

## Change
Add the same guard used by the other jauge RPCs at the top of the function body:
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_entreprise_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: close_test_session access denied for this etablissement';
  END IF;

## What does NOT change
- EXECUTE privileges (authenticated + service_role remain).
- The rest of the function body (DELETE jauge_actions, DELETE jauge_etat, UPDATE etablissements).
- No other function is touched.

## Rollback
To restore the previous definition (no guard), re-run the old CREATE OR REPLACE
without the guard block (see audit notes for the exact SQL).
*/

CREATE OR REPLACE FUNCTION public.close_test_session(p_entreprise_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
IF NOT (
  COALESCE(auth.role() = 'service_role', false)
  OR COALESCE(is_super_admin(), false)
  OR (p_entreprise_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
) THEN
  RAISE EXCEPTION 'unauthorized: close_test_session access denied for this etablissement';
END IF;

DELETE FROM jauge_actions
WHERE etablissement_id = p_entreprise_id
AND is_test = true;

DELETE FROM jauge_etat
WHERE etablissement_id = p_entreprise_id
AND is_test = true;

UPDATE etablissements
SET force_session_active     = false,
    force_session_type       = null,
    force_session_opened_at  = null,
    force_session_expires_at = null
WHERE id = p_entreprise_id;
END;
$function$;
