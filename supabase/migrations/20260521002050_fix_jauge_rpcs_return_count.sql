/*
  # Fix jauge RPCs to return updated count

  ## Changes
  - `increment_jauge`: Dropped and recreated with return type integer — returns the new count_actuel
  - `reset_jauge`: Dropped and recreated with return type integer — returns 0 after reset

  ## Why
  Both functions previously returned void, so the edge function always received null → 0.
  Also fixes RETURNING reliability by using a separate SELECT after the upsert.
  SECURITY DEFINER ensures the functions can bypass RLS when called from the edge function
  using the service role.
*/

DROP FUNCTION IF EXISTS increment_jauge(uuid, integer, text, uuid);
DROP FUNCTION IF EXISTS reset_jauge(uuid, uuid);

CREATE OR REPLACE FUNCTION increment_jauge(
  p_entreprise_id uuid,
  p_delta         integer,
  p_source        text,
  p_user_id       uuid
) RETURNS integer AS $$
DECLARE
  v_new integer;
BEGIN
  INSERT INTO jauge_etat (entreprise_id, count_actuel, date_soiree)
  VALUES (p_entreprise_id, GREATEST(0, p_delta), CURRENT_DATE)
  ON CONFLICT (entreprise_id, date_soiree)
  DO UPDATE SET
    count_actuel = GREATEST(0, jauge_etat.count_actuel + p_delta),
    updated_at   = now(),
    updated_by   = p_user_id::text;

  SELECT count_actuel INTO v_new
  FROM jauge_etat
  WHERE entreprise_id = p_entreprise_id
    AND date_soiree   = CURRENT_DATE;

  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by)
  VALUES (
    p_entreprise_id,
    CASE WHEN p_delta > 0 THEN 'entree' ELSE 'sortie' END,
    p_delta,
    p_source,
    p_user_id
  );

  RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_jauge(
  p_entreprise_id uuid,
  p_user_id       uuid
) RETURNS integer AS $$
BEGIN
  INSERT INTO jauge_etat (entreprise_id, count_actuel, date_soiree)
  VALUES (p_entreprise_id, 0, CURRENT_DATE)
  ON CONFLICT (entreprise_id, date_soiree)
  DO UPDATE SET
    count_actuel = 0,
    updated_at   = now(),
    updated_by   = p_user_id::text;

  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by)
  VALUES (p_entreprise_id, 'reset', 0, 'app', p_user_id);

  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
