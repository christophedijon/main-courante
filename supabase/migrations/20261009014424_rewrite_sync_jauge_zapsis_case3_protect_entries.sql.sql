/*
# Rewrite sync_jauge_zapsis Case 3: protect entries and sorties on ZAPSIS counter reset

## Old behavior
When ZAPSIS returns a value < baseline, the function immediately:
- Resets entrees_billetterie = 0
- Resets sorties_boutons = 0
- Resets count_actuel = 0
- Sets new baseline = ZAPSIS value

This destroys all counted entries and Flic sorties for the soirée on a single
glitched ZAPSIS reading.

## New behavior
When ZAPSIS < baseline:
1. Increment zapsis_low_readings counter
2. If zapsis_low_readings < 3: ignore the reading (keep current state), log a WARNING
3. If zapsis_low_readings >= 3 (3 consecutive low readings ~9 min):
   - Preserve already-counted net entries: entrees_cumulees_avant_reset += current entrees_billetterie
   - Set new baseline = ZAPSIS value
   - Reset zapsis_low_readings = 0
   - entrees_billetterie = entrees_cumulees_avant_reset + max(0, ZAPSIS - baseline)
   - sorties_boutons unchanged
   - count_actuel = max(0, entrees_billetterie - sorties_boutons)

When ZAPSIS >= baseline (normal Case 2):
- Reset zapsis_low_readings = 0
- entrees_billetterie = entrees_cumulees_avant_reset + (ZAPSIS - baseline), non-decreasing
- count_actuel = max(0, entrees_billetterie - sorties_boutons)

## Security
- SECURITY DEFINER preserved, auth check preserved, search_path preserved.
- No RLS changes.
*/

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
  v_soiree           date := public.soiree_date();
  v_sorties_boutons  integer;
  v_current_entrees  integer;
  v_baseline         integer;
  v_cumulees         integer;
  v_low_readings     integer;
  v_new_entrees      integer;
  v_new_count        integer;
  v_row_exists       boolean;
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  -- Read current state for this soirée
  SELECT
    COALESCE(sorties_boutons, 0),
    COALESCE(entrees_billetterie, 0),
    COALESCE(baseline_zapsis, 0),
    COALESCE(entrees_cumulees_avant_reset, 0),
    COALESCE(zapsis_low_readings, 0)
  INTO
    v_sorties_boutons, v_current_entrees, v_baseline, v_cumulees, v_low_readings
  FROM jauge_etat
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree = v_soiree
    AND is_test = p_is_test;

  v_row_exists := FOUND;
  v_sorties_boutons := COALESCE(v_sorties_boutons, 0);
  v_current_entrees := COALESCE(v_current_entrees, 0);
  v_baseline := COALESCE(v_baseline, 0);
  v_cumulees := COALESCE(v_cumulees, 0);
  v_low_readings := COALESCE(v_low_readings, 0);

  -- Case 1: New soirée (no row exists)
  -- Baseline = current ZAPSIS value, so net entries = 0
  IF NOT v_row_exists THEN
    v_baseline := p_entrees;
    v_new_entrees := 0;
    v_new_count := 0;

    INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test,
                            entrees_max_zapsis, entrees_billetterie, sorties_boutons,
                            baseline_zapsis, entrees_cumulees_avant_reset, zapsis_low_readings)
    VALUES (p_etablissement_id, v_new_count, v_soiree, p_is_test,
            p_entrees, v_new_entrees, 0, v_baseline, 0, 0);
    RETURN v_new_count;
  END IF;

  -- Case 2: Row exists, ZAPSIS value >= baseline (normal: counter increased or stayed same)
  IF p_entrees >= v_baseline THEN
    v_new_entrees := v_cumulees + (p_entrees - v_baseline);
    -- entrees_billetterie never decreases within a soirée (GREATEST)
    v_new_entrees := GREATEST(v_current_entrees, v_new_entrees);
    v_new_count := GREATEST(0, v_new_entrees - v_sorties_boutons);

    UPDATE jauge_etat SET
      entrees_billetterie            = v_new_entrees,
      count_actuel                   = v_new_count,
      entrees_max_zapsis             = GREATEST(entrees_max_zapsis, p_entrees),
      baseline_zapsis                = v_baseline,
      entrees_cumulees_avant_reset   = v_cumulees,
      zapsis_low_readings            = 0,
      updated_at                     = now()
    WHERE etablissement_id = p_etablissement_id
      AND date_soiree = v_soiree
      AND is_test = p_is_test;

    RETURN v_new_count;
  END IF;

  -- Case 3: Row exists, ZAPSIS value < baseline (possible ZAPSIS counter reset)
  v_low_readings := v_low_readings + 1;

  IF v_low_readings < 3 THEN
    -- Isolated low reading: ignore, keep current state, log warning
    RAISE WARNING 'sync_jauge_zapsis: ZAPSIS low reading %/3 — old baseline %, new value % for etab %, soirée %. Ignoring.',
      v_low_readings, v_baseline, p_entrees, p_etablissement_id, v_soiree;

    UPDATE jauge_etat SET
      zapsis_low_readings = v_low_readings,
      updated_at          = now()
    WHERE etablissement_id = p_etablissement_id
      AND date_soiree = v_soiree
      AND is_test = p_is_test;

    -- Return current count (unchanged)
    RETURN GREATEST(0, v_current_entrees - v_sorties_boutons);
  END IF;

  -- 3 consecutive low readings: confirmed ZAPSIS reset
  -- Preserve already-counted net entries, set new baseline
  v_cumulees := v_cumulees + v_current_entrees;
  v_baseline := p_entrees;
  v_new_entrees := v_cumulees + GREATEST(0, p_entrees - v_baseline);
  v_new_entrees := GREATEST(v_current_entrees, v_new_entrees);
  v_new_count := GREATEST(0, v_new_entrees - v_sorties_boutons);

  RAISE WARNING 'sync_jauge_zapsis: ZAPSIS reset confirmed (3/3) — old baseline %, new baseline %, cumulated entries % for etab %, soirée %.',
    v_baseline, p_entrees, v_cumulees, p_etablissement_id, v_soiree;

  UPDATE jauge_etat SET
    entrees_billetterie            = v_new_entrees,
    count_actuel                   = v_new_count,
    entrees_max_zapsis             = GREATEST(entrees_max_zapsis, p_entrees),
    baseline_zapsis                = v_baseline,
    entrees_cumulees_avant_reset   = v_cumulees,
    zapsis_low_readings            = 0,
    sorties_boutons                = sorties_boutons,
    updated_at                     = now()
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree = v_soiree
    AND is_test = p_is_test;

  RETURN v_new_count;
END;
$function$;
