/*
  # Add set_entrees_manuelles RPC

  ## Summary
  New function for the manual entry (carte Jauge / toolbox) use-case where the agent
  types the cumulative total of tickets sold.  The correct current occupancy is:

      count_actuel = total_manual_entries - total_flic_exits_today

  The previous approach wrote `count_actuel = typed_value` directly, which silently
  discarded any Flic-button exits already recorded for the day.

  ## New Function
  - `set_entrees_manuelles(p_entreprise_id, p_entrees, p_user_id)`
    1. Sums all 'sortie' deltas in jauge_actions for today (absolute value).
    2. Computes new_count = GREATEST(0, p_entrees - total_sorties).
    3. Upserts jauge_etat with the computed count.
    4. Inserts a 'entree' record in jauge_actions with delta = p_entrees and
       source = 'manuel', so subsequent calls can recalculate correctly.
    5. Returns the new count_actuel.

  ## Security
  - SECURITY DEFINER so it runs with elevated privileges (same pattern as
    increment_jauge / reset_jauge).
*/

CREATE OR REPLACE FUNCTION set_entrees_manuelles(
  p_entreprise_id uuid,
  p_entrees       integer,
  p_user_id       uuid
) RETURNS integer AS $$
DECLARE
  v_sorties    integer;
  v_new_count  integer;
BEGIN
  -- Total absolute exits recorded today (Flic or any other source)
  SELECT COALESCE(ABS(SUM(delta)), 0) INTO v_sorties
  FROM jauge_actions
  WHERE entreprise_id = p_entreprise_id
    AND action        = 'sortie'
    AND created_at::date = CURRENT_DATE;

  v_new_count := GREATEST(0, p_entrees - v_sorties);

  -- Upsert current occupancy
  INSERT INTO jauge_etat (entreprise_id, count_actuel, date_soiree)
  VALUES (p_entreprise_id, v_new_count, CURRENT_DATE)
  ON CONFLICT (entreprise_id, date_soiree)
  DO UPDATE SET
    count_actuel = v_new_count,
    updated_at   = now(),
    updated_by   = p_user_id::text;

  -- Audit log: record the new cumulative entry total
  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by)
  VALUES (p_entreprise_id, 'entree', p_entrees, 'manuel', p_user_id);

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
