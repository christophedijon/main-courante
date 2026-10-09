/*
# Rewrite sync_jauge_zapsis with baseline logic

## Context
ZAPSIS sends a cumulative counter. Without a baseline, a new soirée would start
with the previous evening's total. The baseline captures the ZAPSIS value at the
start of the soirée, and entrees_billetterie = ZAPSIS - baseline.

## Logic
1. If no row exists for this soirée (new soirée):
   - baseline_zapsis = p_entrees (the ZAPSIS value right now)
   - entrees_billetterie = p_entrees - baseline = 0
   - count_actuel = 0
2. If row exists and p_entrees >= baseline:
   - entrees_billetterie = p_entrees - baseline
   - count_actuel = entrees_billetterie - sorties_boutons
3. If row exists and p_entrees < baseline (ZAPSIS reset its counter):
   - Update baseline = p_entrees (reset baseline to new ZAPSIS value)
   - entrees_billetterie = 0
   - count_actuel = 0
   - This handles ZAPSIS resetting its counter mid-evening (shouldn't happen but safe)
4. entrees_billetterie uses GREATEST with previous value (never decreases within soirée
   except when ZAPSIS resets, which sets baseline accordingly)

## Security
- SECURITY DEFINER, search_path public
- Auth check preserved
*/

CREATE OR REPLACE FUNCTION public.sync_jauge_zapsis(p_etablissement_id uuid, p_entrees integer, p_is_test boolean DEFAULT false)
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
  SELECT COALESCE(sorties_boutons, 0), COALESCE(entrees_billetterie, 0), COALESCE(baseline_zapsis, 0)
    INTO v_sorties_boutons, v_current_entrees, v_baseline
  FROM jauge_etat
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree = v_soiree
    AND is_test = p_is_test;

  v_row_exists := FOUND;
  v_sorties_boutons := COALESCE(v_sorties_boutons, 0);
  v_current_entrees := COALESCE(v_current_entrees, 0);
  v_baseline := COALESCE(v_baseline, 0);

  -- Case 1: New soirée (no row exists)
  -- Baseline = current ZAPSIS value, so net entries = 0
  IF NOT v_row_exists THEN
    v_baseline := p_entrees;
    v_new_entrees := 0;
    v_new_count := 0;

    INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test,
                            entrees_max_zapsis, entrees_billetterie, sorties_boutons, baseline_zapsis)
    VALUES (p_etablissement_id, v_new_count, v_soiree, p_is_test,
            p_entrees, v_new_entrees, 0, v_baseline);
    RETURN v_new_count;
  END IF;

  -- Case 2: Row exists, ZAPSIS value >= baseline (normal: counter increased or stayed same)
  IF p_entrees >= v_baseline THEN
    v_new_entrees := p_entrees - v_baseline;
    -- entrees_billetterie never decreases within a soirée (GREATEST)
    v_new_entrees := GREATEST(v_current_entrees, v_new_entrees);
    v_new_count := GREATEST(0, v_new_entrees - v_sorties_boutons);

    UPDATE jauge_etat SET
      entrees_billetterie = v_new_entrees,
      count_actuel        = v_new_count,
      entrees_max_zapsis  = GREATEST(entrees_max_zapsis, p_entrees),
      baseline_zapsis     = v_baseline,
      updated_at          = now()
    WHERE etablissement_id = p_etablissement_id
      AND date_soiree = v_soiree
      AND is_test = p_is_test;

    RETURN v_new_count;
  END IF;

  -- Case 3: Row exists, ZAPSIS value < baseline (ZAPSIS reset its counter)
  -- Reset baseline to the new ZAPSIS value, net entries = 0
  RAISE WARNING 'sync_jauge_zapsis: ZAPSIS counter reset detected — old baseline %, new value % for etab %, soirée %',
    v_baseline, p_entrees, p_etablissement_id, v_soiree;

  v_baseline := p_entrees;
  v_new_entrees := 0;
  v_new_count := 0;

  UPDATE jauge_etat SET
    entrees_billetterie = v_new_entrees,
    count_actuel        = v_new_count,
    entrees_max_zapsis  = GREATEST(entrees_max_zapsis, p_entrees),
    baseline_zapsis     = v_baseline,
    sorties_boutons     = 0,
    updated_at          = now()
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree = v_soiree
    AND is_test = p_is_test;

  RETURN v_new_count;
END;
$function$;
