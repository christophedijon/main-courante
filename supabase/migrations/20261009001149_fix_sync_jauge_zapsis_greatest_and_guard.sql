/*
# Fix sync_jauge_zapsis: GREATEST on entrees_billetterie + guard against ZAPSIS reset

## Context
sync_jauge_zapsis overwrote entrees_billetterie with the raw ZAPSIS value on every
poll (every 3 minutes). When ZAPSIS resets its counter at the start of a new evening,
the new lower value would overwrite the previous evening's higher value, corrupting
the jauge for the ongoing soirée.

## Changes
1. entrees_billetterie uses GREATEST in DO UPDATE — never decreases within a soirée
2. If ZAPSIS returns a value LOWER than the current entrees_billetterie, log a warning
   and skip the update (don't overwrite). This handles the case where ZAPSIS resets
   its counter mid-evening (shouldn't happen, but protects against data loss).
3. count_actuel is always recalculated from entrees_billetterie - sorties_boutons
4. The INSERT path (new line for a new soirée) works as before — creates the line.

## Security
- No RLS changes
- Function remains SECURITY DEFINER
- search_path remains public
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
  v_new_count        integer;
  v_current_entrees  integer;
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(is_super_admin(), false)
    OR (p_etablissement_id = get_user_etablissement_id() AND get_user_etablissement_id() IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'unauthorized: jauge access denied for this etablissement';
  END IF;

  -- Read current state for this soirée
  SELECT COALESCE(sorties_boutons, 0), COALESCE(entrees_billetterie, 0)
    INTO v_sorties_boutons, v_current_entrees
  FROM jauge_etat
  WHERE etablissement_id = p_etablissement_id
    AND date_soiree = v_soiree
    AND is_test = p_is_test;

  -- If no row exists, v_sorties_boutons and v_current_entrees are NULL → treat as 0
  v_sorties_boutons := COALESCE(v_sorties_boutons, 0);
  v_current_entrees := COALESCE(v_current_entrees, 0);

  -- Guard: if ZAPSIS returns a lower value than what we already have,
  -- it likely reset its counter. Don't overwrite — log a warning.
  IF p_entrees < v_current_entrees THEN
    RAISE WARNING 'sync_jauge_zapsis: ZAPSIS returned %, lower than current entrees_billetterie % for etab %, soirée % — skipping update',
      p_entrees, v_current_entrees, p_etablissement_id, v_soiree;
    -- Return the current count (unchanged)
    RETURN GREATEST(0, v_current_entrees - v_sorties_boutons);
  END IF;

  v_new_count := GREATEST(0, p_entrees - v_sorties_boutons);

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_max_zapsis, entrees_billetterie, sorties_boutons)
  VALUES (p_etablissement_id, v_new_count, v_soiree, p_is_test, p_entrees, p_entrees, v_sorties_boutons)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    entrees_billetterie = GREATEST(jauge_etat.entrees_billetterie, p_entrees),
    count_actuel        = GREATEST(0, GREATEST(jauge_etat.entrees_billetterie, p_entrees) - jauge_etat.sorties_boutons),
    entrees_max_zapsis  = GREATEST(jauge_etat.entrees_max_zapsis, p_entrees),
    sorties_boutons     = jauge_etat.sorties_boutons,
    updated_at          = now();

  RETURN v_new_count;
END;
$function$;
