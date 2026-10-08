/*
# Fix: increment_jauge/reset_jauge p_user_id type mismatch

Les fonctions increment_jauge et reset_jauge ont p_user_id en text,
mais jauge_actions.created_by est uuid. On corrige le type du parametre.
*/

-- Recreate increment_jauge with p_user_id as uuid (nullable)
DROP FUNCTION IF EXISTS public.increment_jauge(uuid, integer, text, text, boolean, text);

CREATE OR REPLACE FUNCTION public.increment_jauge(
  p_etablissement_id uuid,
  p_delta integer,
  p_source text DEFAULT 'flic',
  p_user_id uuid DEFAULT NULL,
  p_is_test boolean DEFAULT false,
  p_mode_jauge text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new             integer;
  v_current_entrees integer;
  v_current_sorties integer;
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  IF p_mode_jauge = 'automatique' AND p_delta > 0 THEN
    RAISE EXCEPTION 'entry_forbidden_in_automatic_mode';
  END IF;

  IF p_mode_jauge = 'automatique' THEN
    SELECT COALESCE(entrees_billetterie, 0), COALESCE(sorties_boutons, 0)
      INTO v_current_entrees, v_current_sorties
    FROM jauge_etat
    WHERE etablissement_id = p_etablissement_id
      AND date_soiree = CURRENT_DATE
      AND is_test = p_is_test;

    v_current_sorties := COALESCE(v_current_sorties, 0) + ABS(p_delta);
    v_new := GREATEST(0, COALESCE(v_current_entrees, 0) - v_current_sorties);

    INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_billetterie, sorties_boutons)
    VALUES (p_etablissement_id, v_new, CURRENT_DATE, p_is_test, 0, v_current_sorties)
    ON CONFLICT (etablissement_id, date_soiree, is_test)
    DO UPDATE SET
      sorties_boutons = jauge_etat.sorties_boutons + ABS(p_delta),
      count_actuel    = GREATEST(0, jauge_etat.entrees_billetterie - (jauge_etat.sorties_boutons + ABS(p_delta))),
      updated_at      = now(),
      updated_by      = p_user_id::text;

    SELECT count_actuel INTO v_new
    FROM jauge_etat
    WHERE etablissement_id = p_etablissement_id
      AND date_soiree = CURRENT_DATE
      AND is_test = p_is_test;

    INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
    VALUES (p_etablissement_id, 'sortie', p_delta, p_source, p_user_id, p_is_test);

    RETURN v_new;
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
    AND date_soiree = CURRENT_DATE
    AND is_test = p_is_test;

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

-- Recreate reset_jauge with p_user_id as uuid
DROP FUNCTION IF EXISTS public.reset_jauge(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.reset_jauge(
  p_etablissement_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_billetterie, sorties_boutons)
  VALUES (p_etablissement_id, 0, CURRENT_DATE, p_is_test, 0, 0)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel        = 0,
    entrees_billetterie = 0,
    sorties_boutons     = 0,
    updated_at          = now(),
    updated_by          = p_user_id::text;

  INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
  VALUES (p_etablissement_id, 'reset', 0, 'app', p_user_id, p_is_test);

  RETURN 0;
END;
$$;

-- Recreate set_entrees_manuelles with p_user_id as uuid
DROP FUNCTION IF EXISTS public.set_entrees_manuelles(uuid, integer, text, boolean);

CREATE OR REPLACE FUNCTION public.set_entrees_manuelles(
  p_etablissement_id uuid,
  p_entrees integer,
  p_user_id uuid DEFAULT NULL,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sorties_boutons integer;
  v_new_count       integer;
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  SELECT COALESCE(sorties_boutons, 0) INTO v_sorties_boutons
  FROM jauge_etat
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree = CURRENT_DATE
    AND is_test = p_is_test;

  v_new_count := GREATEST(0, p_entrees - v_sorties_boutons);

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_billetterie, sorties_boutons)
  VALUES (p_etablissement_id, v_new_count, CURRENT_DATE, p_is_test, p_entrees, 0)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    entrees_billetterie = p_entrees,
    count_actuel        = GREATEST(0, p_entrees - jauge_etat.sorties_boutons),
    updated_at          = now(),
    updated_by          = p_user_id::text;

  INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
  VALUES (p_etablissement_id, 'entree', p_entrees, 'manuel', p_user_id, p_is_test);

  RETURN v_new_count;
END;
$$;
