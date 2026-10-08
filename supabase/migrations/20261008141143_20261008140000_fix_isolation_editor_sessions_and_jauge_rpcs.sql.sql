/*
# Fix isolation defects: editor_sessions policies + SECURITY DEFINER guard bypass

## 1. editor_sessions — remove 3 old policies with correlated subquery on entreprise_id

The old SELECT/INSERT/UPDATE policies on editor_sessions used:
  entreprise_id IN (SELECT editor_sessions.entreprise_id FROM super_admins WHERE ...)
This is a correlated subquery that references the outer table's column inside
the subquery, making the condition always TRUE for any row where the subquery
returns at least one row. This leaked editor_sessions across establishments.

The correct policy `editor_sessions_isolation` (ALL, using etablissement_id =
get_my_entreprise_id() OR is_super_admin()) already exists and is sufficient.

Action: DROP the 3 old policies. Keep editor_sessions_isolation and the anon
SELECT policy (for active session lookup by code).

## 2. increment_jauge, reset_jauge, set_entrees_manuelles — NULL-prone guard

These SECURITY DEFINER functions check:
  IF NOT (auth.role() = 'service_role' OR is_super_admin()
  OR p_etablissement_id = get_user_etablissement_id()) THEN RAISE

In a SECURITY DEFINER function, auth.role() returns NULL (not 'authenticated'
or 'service_role'). NULL = 'service_role' evaluates to NULL. Combined with
false OR false, the whole OR chain is NULL. NOT NULL is NULL. In PL/pgSQL,
IF NULL is treated as IF false, so the RAISE is skipped — the guard is
bypassed entirely.

Fix: Wrap each condition in COALESCE(..., false) so NULL becomes false:
  IF NOT (COALESCE(auth.role() = 'service_role', false)
  OR COALESCE(is_super_admin(), false)
  OR (p_etablissement_id = get_user_etablissement_id()
      AND get_user_etablissement_id() IS NOT NULL)) THEN RAISE

## 3. sync_jauge_zapsis — missing authorization guard

This SECURITY DEFINER function had NO authorization check at all. Any
authenticated user could call it with any etablissement_id to modify jauge
data. Added the same COALESCE-based guard.

## Security impact
- editor_sessions: closes cross-establishment data leak (4 rows visible)
- jauge RPCs: closes cross-establishment write access (jauge count, entries)
- No changes to legitimate access: SuperAdmin and service_role still bypass
  the guard; users can still modify their own establishment's jauge.
*/

-- =====================================================================
-- PART A: editor_sessions — drop defective old policies
-- =====================================================================

DROP POLICY IF EXISTS "Users can read editor sessions for their entreprise" ON public.editor_sessions;
DROP POLICY IF EXISTS "Users can insert editor sessions for their entreprise" ON public.editor_sessions;
DROP POLICY IF EXISTS "Users can update editor sessions for their entreprise" ON public.editor_sessions;

-- =====================================================================
-- PART C: Fix SECURITY DEFINER function guards
-- =====================================================================

CREATE OR REPLACE FUNCTION public.increment_jauge(
  p_etablissement_id uuid,
  p_delta integer,
  p_source text,
  p_user_id uuid,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new integer;
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.reset_jauge(
  p_etablissement_id uuid,
  p_user_id uuid,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.set_entrees_manuelles(
  p_etablissement_id uuid,
  p_entrees integer,
  p_user_id uuid,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sorties   integer;
  v_new_count integer;
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_jauge_zapsis(
  p_etablissement_id uuid,
  p_entrees integer,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sorties   integer;
  v_new_count integer;
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  SELECT COALESCE(SUM(ABS(delta)), 0) INTO v_sorties
  FROM jauge_actions
  WHERE etablissement_id = p_etablissement_id
  AND action            = 'sortie'
  AND is_test           = p_is_test
  AND created_at::date  = CURRENT_DATE;

  v_new_count := GREATEST(0, p_entrees - v_sorties);

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_max_zapsis)
  VALUES (p_etablissement_id, v_new_count, CURRENT_DATE, p_is_test, p_entrees)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel       = v_new_count,
    entrees_max_zapsis = GREATEST(jauge_etat.entrees_max_zapsis, p_entrees),
    updated_at         = now();

  RETURN v_new_count;
END;
$function$;
