-- Revoke EXECUTE on store_service_role_key from PUBLIC, anon, authenticated.
-- This function writes the service_role_key into vault.secrets and has NO internal
-- access control. It is not called by any application code (frontend or edge function).
-- Only postgres/service_role need it.
REVOKE EXECUTE ON FUNCTION public.store_service_role_key(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.store_service_role_key(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_service_role_key(text) FROM authenticated;
