-- The previous REVOKE FROM anon had no effect because these functions were granted
-- to PUBLIC (=X/postgres in proacl), which anon inherits.
-- Fix: REVOKE FROM PUBLIC and explicitly keep authenticated + service_role.
-- Kept with public access: helper RLS functions (is_super_admin, is_mega_admin,
-- is_direction_or_super_admin, get_user_etablissement_id, get_my_entreprise_id)
-- and jauge functions (increment_jauge, reset_jauge, set_entrees_manuelles).

REVOKE EXECUTE ON FUNCTION public.activer_client(uuid, text)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_test_session(uuid)                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_exceptional_session(uuid)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.open_test_session(uuid, timestamptz)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.open_exceptional_session(uuid, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.creer_client_brouillon()                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expirer_essais()                            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reschedule_rapport_cron(text)               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_reschedule_rapport_cron()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_service_role_key(text)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_signature_user_data()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_first_login()                          FROM PUBLIC;

-- Ensure authenticated and service_role can still call them (explicit grants as safety net)
GRANT EXECUTE ON FUNCTION public.activer_client(uuid, text)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_test_session(uuid)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_exceptional_session(uuid)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_test_session(uuid, timestamptz)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_exceptional_session(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.creer_client_brouillon()                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expirer_essais()                            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_rapport_cron(text)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_fn_reschedule_rapport_cron()            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_service_role_key(text)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fill_signature_user_data()                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_first_login()                          TO authenticated, service_role;
