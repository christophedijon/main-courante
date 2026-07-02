-- REVOKE EXECUTE from anon for all SECURITY DEFINER functions that don't need unauthenticated access.
-- Kept: is_super_admin, is_mega_admin, is_direction_or_super_admin, get_user_etablissement_id,
--       get_my_entreprise_id (required for RLS policy evaluation by anon role),
--       increment_jauge, reset_jauge, set_entrees_manuelles (required for public Flic jauge).

REVOKE EXECUTE ON FUNCTION public.activer_client(uuid, text)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_test_session(uuid)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_exceptional_session(uuid)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.open_test_session(uuid, timestamptz)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.open_exceptional_session(uuid, timestamptz)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.creer_client_brouillon()                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.expirer_essais()                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.reschedule_rapport_cron(text)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_reschedule_rapport_cron()                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_service_role_key(text)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.fill_signature_user_data()                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_first_login()                                  FROM anon;
