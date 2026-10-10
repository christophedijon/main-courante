/*
# Revoke EXECUTE on is_direction_of_etab from PUBLIC and anon

## Why
The function is_direction_of_etab() is used in RLS policies on email_rules.
It should only be callable by authenticated users (who have a real auth.uid())
and the service_role (used by edge functions). Granting EXECUTE to PUBLIC
means anon (unauthenticated) can call it — unnecessary exposure.

## What changed
- REVOKE EXECUTE FROM PUBLIC
- REVOKE EXECUTE FROM anon
- GRANT EXECUTE TO authenticated (already had it, re-grant for clarity)
- GRANT EXECUTE TO service_role (already had it, re-grant for clarity)

## Security note
The function is SECURITY INVOKER (not DEFINER), so it runs with the caller's
privileges. With anon's EXECUTE revoked, anon cannot call it at all.
*/
REVOKE EXECUTE ON FUNCTION public.is_direction_of_etab(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_direction_of_etab(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_direction_of_etab(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_direction_of_etab(uuid) TO service_role;
