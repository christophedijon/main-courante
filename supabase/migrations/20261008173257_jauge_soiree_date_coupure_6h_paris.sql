/*
# Jauge: date de soiree avec coupure 6h Paris + suppression ancienne signature increment_jauge

## Contexte
Les etablissements ouverts la nuit (ex: 23h-5h) doivent avoir UNE SEULE ligne de soiree.
Actuellement, date_soiree = CURRENT_DATE qui bascule a minuit: une soiree qui commence a 23h
se retrouve coupee en deux lignes (une pour aujourd'hui, une pour demain).

## Changes

### 1. New function: public.soiree_date()
Retourne la date de la soiree courante en fuseau Europe/Paris.
Si l'heure locale est avant 6h du matin, la soiree est celle de la veille.
Ex: a 00h30 -> soiree d'hier. A 05h30 -> soiree d'hier. A 06h30 -> soiree d'aujourd'hui.

### 2. Drop old increment_jauge signature (without p_mode_jauge)
L'ancienne signature n'avait pas le garde-fou du mode automatique et utilisait CURRENT_DATE.

### 3. Update all jauge RPCs to use soiree_date() instead of CURRENT_DATE

## Security
- Aucun changement de RLS.
- Les garde-fous d'autorisation sont preserves.
- L'ancienne signature increment_jauge sans p_mode_jauge est supprimee.
*/

-- 1. Creer la fonction soiree_date
CREATE OR REPLACE FUNCTION public.soiree_date()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN (now() AT TIME ZONE 'Europe/Paris')::time < '06:00'::time
      THEN ((now() AT TIME ZONE 'Europe/Paris') - interval '1 day')::date
    ELSE (now() AT TIME ZONE 'Europe/Paris')::date
  END
$$;

-- 2. Supprimer l'ancienne signature increment_jauge (sans p_mode_jauge)
DROP FUNCTION IF EXISTS public.increment_jauge(uuid, integer, text, uuid, boolean);

-- 3. Recreer increment_jauge avec soiree_date() et p_mode_jauge
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
  v_soiree           date := public.soiree_date();
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
      AND date_soiree = v_soiree
      AND is_test = p_is_test;

    v_current_sorties := COALESCE(v_current_sorties, 0) + ABS(p_delta);
    v_new := GREATEST(0, COALESCE(v_current_entrees, 0) - v_current_sorties);

    INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_billetterie, sorties_boutons)
    VALUES (p_etablissement_id, v_new, v_soiree, p_is_test, 0, v_current_sorties)
    ON CONFLICT (etablissement_id, date_soiree, is_test)
    DO UPDATE SET
      sorties_boutons = jauge_etat.sorties_boutons + ABS(p_delta),
      count_actuel    = GREATEST(0, jauge_etat.entrees_billetterie - (jauge_etat.sorties_boutons + ABS(p_delta))),
      updated_at      = now(),
      updated_by      = p_user_id::text;

    SELECT count_actuel INTO v_new
    FROM jauge_etat
    WHERE etablissement_id = p_etablissement_id
      AND date_soiree = v_soiree
      AND is_test = p_is_test;

    INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
    VALUES (p_etablissement_id, 'sortie', p_delta, p_source, p_user_id, p_is_test);

    RETURN v_new;
  END IF;

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test)
  VALUES (p_etablissement_id, GREATEST(0, p_delta), v_soiree, p_is_test)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel = GREATEST(0, jauge_etat.count_actuel + p_delta),
    updated_at   = now(),
    updated_by   = p_user_id::text;

  SELECT count_actuel INTO v_new
  FROM jauge_etat
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree = v_soiree
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

-- 4. Recreer sync_jauge_zapsis avec soiree_date()
CREATE OR REPLACE FUNCTION public.sync_jauge_zapsis(
  p_etablissement_id uuid,
  p_entrees integer,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_soiree         date := public.soiree_date();
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
    AND date_soiree = v_soiree
    AND is_test = p_is_test;

  v_new_count := GREATEST(0, p_entrees - v_sorties_boutons);

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_max_zapsis, entrees_billetterie, sorties_boutons)
  VALUES (p_etablissement_id, v_new_count, v_soiree, p_is_test, p_entrees, p_entrees, 0)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    entrees_billetterie = p_entrees,
    count_actuel        = GREATEST(0, p_entrees - jauge_etat.sorties_boutons),
    entrees_max_zapsis  = GREATEST(jauge_etat.entrees_max_zapsis, p_entrees),
    updated_at          = now();

  RETURN v_new_count;
END;
$$;

-- 5. Recreer reset_jauge avec soiree_date()
CREATE OR REPLACE FUNCTION public.reset_jauge(
  p_etablissement_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_is_test boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_soiree date := public.soiree_date();
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_billetterie, sorties_boutons)
  VALUES (p_etablissement_id, 0, v_soiree, p_is_test, 0, 0)
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

-- 6. Recreer set_entrees_manuelles avec soiree_date()
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
  v_soiree         date := public.soiree_date();
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
    AND date_soiree = v_soiree
    AND is_test = p_is_test;

  v_new_count := GREATEST(0, p_entrees - v_sorties_boutons);

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_billetterie, sorties_boutons)
  VALUES (p_etablissement_id, v_new_count, v_soiree, p_is_test, p_entrees, 0)
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
