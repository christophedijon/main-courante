CREATE OR REPLACE FUNCTION public.close_test_session(p_entreprise_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
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
