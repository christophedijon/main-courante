-- Add SET search_path = public to all functions flagged as "Function Search Path Mutable".
-- mark_first_login already has it set — skipped.
-- Uses ALTER FUNCTION to avoid rewriting function bodies.

ALTER FUNCTION public.is_super_admin()                                              SET search_path = public;
ALTER FUNCTION public.is_direction_or_super_admin()                                 SET search_path = public;
ALTER FUNCTION public.is_mega_admin()                                               SET search_path = public;
ALTER FUNCTION public.get_user_etablissement_id()                                   SET search_path = public;
ALTER FUNCTION public.set_evenement_numero()                                        SET search_path = public;
ALTER FUNCTION public.reschedule_rapport_cron(text)                                 SET search_path = public;
ALTER FUNCTION public.trg_fn_reschedule_rapport_cron()                              SET search_path = public;
ALTER FUNCTION public.set_service_role_key(text)                                    SET search_path = public;
ALTER FUNCTION public.open_test_session(uuid, timestamptz)                          SET search_path = public;
ALTER FUNCTION public.open_exceptional_session(uuid, timestamptz)                   SET search_path = public;
ALTER FUNCTION public.close_test_session(uuid)                                      SET search_path = public;
ALTER FUNCTION public.close_exceptional_session(uuid)                               SET search_path = public;
ALTER FUNCTION public.fill_signature_user_data()                                    SET search_path = public;
ALTER FUNCTION public.creer_client_brouillon()                                      SET search_path = public;
ALTER FUNCTION public.activer_client(uuid, text)                                    SET search_path = public;
ALTER FUNCTION public.expirer_essais()                                              SET search_path = public;
ALTER FUNCTION public.increment_jauge(uuid, integer, text, uuid, boolean)           SET search_path = public;
ALTER FUNCTION public.reset_jauge(uuid, uuid, boolean)                              SET search_path = public;
ALTER FUNCTION public.set_entrees_manuelles(uuid, integer, uuid, boolean)           SET search_path = public;
