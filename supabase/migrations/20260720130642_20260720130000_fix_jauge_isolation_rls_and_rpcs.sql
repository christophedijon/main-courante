/*
# Fix jauge multi-tenant isolation (RLS WITH CHECK + public RPC + RPC ownership checks)

## Context
Audit of the jauge feature (jauge_actions / jauge_etat) revealed three
isolation flaws that allowed cross-tenant reads or writes:
1. RLS policies "jauge_actions_isolation" and "jauge_etat_isolation" had
   WITH CHECK = null, so INSERT/UPDATE were NOT enforced. An authenticated
   user could write rows with any etablissement_id and the row would pass.
2. The anon policy "anon_read_jauge_etat_public" exposed EVERY establishment's
   real-time gauge to anyone holding the anon key (filtered only by
   is_test = false, with no etablissement_id filter).
3. SECURITY DEFINER RPCs (increment_jauge, reset_jauge, set_entrees_manuelles)
   accepted p_etablissement_id from the client with no server-side ownership
   check, allowing an authenticated user to write the gauge of any establishment.

## Changes

### 1. RLS — WITH CHECK on isolation policies
- Recreate "jauge_actions_isolation" and "jauge_etat_isolation" as FOR ALL
  with WITH CHECK identical to USING. Writes are now scoped to the caller's
  establishment (etablissement_id = get_my_entreprise_id()) or to super admins.

### 2. Public anon access — scoped RPC
- Drop "anon_read_jauge_etat_public" (was unfiltered across all establishments).
- Add SECURITY DEFINER function get_public_jauge(p_etablissement_id uuid)
  returning only (count_actuel, date_soiree, is_test) for the requested
  establishment, non-test rows only, today only. Execute granted to anon and
  authenticated. PublicJaugePage.tsx now calls this RPC instead of a direct
  table SELECT, so the establishment id is an explicit server-enforced argument.

### 3. RPC ownership checks
- increment_jauge, reset_jauge, set_entrees_manuelles: add a guard at the top
  of each function:
    IF NOT (auth.role() = 'service_role' OR is_super_admin()
            OR p_etablissement_id = get_user_etablissement_id())
    THEN RAISE EXCEPTION 'unauthorized'.
  The service_role bypass is required so the flic-jauge edge function (which
  uses the service role key and has no auth user) keeps working. Super admins
  and the establishment's own users are allowed; everyone else is rejected.
  The parameter name (p_etablissement_id) and the written column
  (etablissement_id) were already correct since migration 20260630074619 —
  only the ownership check was missing.

## Notes
- No data is modified or deleted; existing rows are preserved.
- The legacy entreprise_id column is no longer written by these RPCs (already
  the case since 20260630074619); it is retained for read compatibility.
- BackupPage.tsx uses the user-session supabase client, so RLS already
  restricts reads to the caller's establishment (or all rows for super admin) —
  no change required there.
*/

-- ─── 1. RLS: add WITH CHECK to isolation policies ───────────────────────
DROP POLICY IF EXISTS "jauge_actions_isolation" ON public.jauge_actions;
CREATE POLICY "jauge_actions_isolation"
  ON public.jauge_actions FOR ALL TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "jauge_etat_isolation" ON public.jauge_etat;
CREATE POLICY "jauge_etat_isolation"
  ON public.jauge_etat FOR ALL TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

-- ─── 2. Remove unfiltered anon read; add scoped public RPC ─────────────
DROP POLICY IF EXISTS "anon_read_jauge_etat_public" ON public.jauge_etat;

CREATE OR REPLACE FUNCTION public.get_public_jauge(p_etablissement_id uuid)
RETURNS TABLE(count_actuel integer, date_soiree date, is_test boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT je.count_actuel, je.date_soiree, je.is_test
  FROM public.jauge_etat je
  WHERE je.etablissement_id = p_etablissement_id
    AND je.is_test = false
    AND je.date_soiree = CURRENT_DATE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_jauge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_jauge(uuid) TO anon, authenticated;

-- ─── 3. Add ownership checks to jauge RPCs ──────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_jauge(
  p_etablissement_id uuid,
  p_delta            integer,
  p_source           text,
  p_user_id          uuid,
  p_is_test          boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  IF NOT (auth.role() = 'service_role' OR is_super_admin()
          OR p_etablissement_id = get_user_etablissement_id()) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test)
  VALUES (p_etablissement_id, GREATEST(0, p_delta), CURRENT_DATE, p_is_test)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel = GREATEST(0, jauge_etat.count_actuel + p_delta),
    updated_at   = now(),
    updated_by   = p_user_id::text;

  SELECT count_actuel INTO v_new
  FROM jauge_etat
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree       = CURRENT_DATE
    AND is_test           = p_is_test;

  INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
  VALUES (
    p_etablissement_id,
    CASE WHEN p_delta > 0 THEN 'entree' ELSE 'sortie' END,
    p_delta,
    p_source,
    p_user_id,
    p_is_test
  );

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_jauge(
  p_etablissement_id uuid,
  p_user_id          uuid,
  p_is_test          boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR is_super_admin()
          OR p_etablissement_id = get_user_etablissement_id()) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test)
  VALUES (p_etablissement_id, 0, CURRENT_DATE, p_is_test)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel = 0,
    updated_at   = now(),
    updated_by   = p_user_id::text;

  INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
  VALUES (p_etablissement_id, 'reset', 0, 'app', p_user_id, p_is_test);

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_entrees_manuelles(
  p_etablissement_id uuid,
  p_entrees          integer,
  p_user_id          uuid,
  p_is_test          boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sorties   integer;
  v_new_count integer;
BEGIN
  IF NOT (auth.role() = 'service_role' OR is_super_admin()
          OR p_etablissement_id = get_user_etablissement_id()) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  SELECT COALESCE(ABS(SUM(delta)), 0) INTO v_sorties
  FROM jauge_actions
  WHERE etablissement_id = p_etablissement_id
    AND action            = 'sortie'
    AND is_test           = p_is_test
    AND created_at::date  = CURRENT_DATE;

  v_new_count := GREATEST(0, p_entrees - v_sorties);

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test)
  VALUES (p_etablissement_id, v_new_count, CURRENT_DATE, p_is_test)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel = v_new_count,
    updated_at   = now(),
    updated_by   = p_user_id::text;

  INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
  VALUES (p_etablissement_id, 'entree', p_entrees, 'manuel', p_user_id, p_is_test);

  RETURN v_new_count;
END;
$$;
