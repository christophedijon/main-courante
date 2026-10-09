/*
# Fix increment_jauge: INSERT path in automatique mode must not create entrees_billetterie=0

## Context
In automatique mode, when a Flic "-" press arrives and no jauge_etat row exists
for the current soirée, the INSERT path creates a row with entrees_billetterie=0.
This makes count_actuel=0 immediately, and the realtime event sends 0 to the
frontend. The row is then "locked in" — sync_jauge_zapsis's Case 2 uses
GREATEST(current=0, p_entrees - baseline) = p_entrees, which recovers, but for
~3 minutes (until the next ZAPSIS poll) the screen shows 0.

## Fix
When the row doesn't exist in automatique mode, refuse the Flic press instead of
creating a row with entrees_billetterie=0. The row should only be created by
sync_jauge_zapsis (which sets the proper ZAPSIS baseline). Return the current
count (0) without modifying anything — the next ZAPSIS poll will create the row.

## Security
- No RLS changes. SECURITY DEFINER preserved. Auth check preserved.
*/

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
AS $function$
DECLARE
  v_soiree           date := public.soiree_date();
  v_new             integer;
  v_current_entrees integer;
  v_current_sorties integer;
  v_row_exists      boolean;
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

    v_row_exists := FOUND;
    v_current_sorties := COALESCE(v_current_sorties, 0);
    v_current_entrees := COALESCE(v_current_entrees, 0);

    -- If no row exists yet, the ZAPSIS sync hasn't run for this soirée.
    -- Refuse the Flic press — creating a row with entrees_billetterie=0 would
    -- show 0 on screen. The next sync_jauge_zapsis poll will create the row
    -- with the correct baseline.
    IF NOT v_row_exists THEN
      INSERT INTO jauge_actions (etablissement_id, action, delta, source, created_by, is_test)
      VALUES (p_etablissement_id, 'sortie', p_delta, p_source, p_user_id, p_is_test);
      RETURN 0;
    END IF;

    v_new := GREATEST(0, v_current_entrees - (v_current_sorties + ABS(p_delta)));

    UPDATE jauge_etat SET
      sorties_boutons = sorties_boutons + ABS(p_delta),
      count_actuel    = GREATEST(0, entrees_billetterie - (sorties_boutons + ABS(p_delta))),
      updated_at      = now(),
      updated_by      = p_user_id::text
    WHERE etablissement_id = p_etablissement_id
      AND date_soiree = v_soiree
      AND is_test = p_is_test;

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
$function$;
