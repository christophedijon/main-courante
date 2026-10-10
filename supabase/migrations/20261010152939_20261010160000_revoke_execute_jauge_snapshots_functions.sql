
-- Revoke EXECUTE on snapshot_jauge_etat and purge_jauge_snapshots from anon, authenticated, and PUBLIC
-- Only postgres and service_role should be able to call these
REVOKE EXECUTE ON FUNCTION public.snapshot_jauge_etat() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_jauge_snapshots() FROM anon, authenticated, PUBLIC;
