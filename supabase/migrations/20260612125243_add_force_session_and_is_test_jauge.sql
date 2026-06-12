-- 1. Add is_test to jauge_etat
ALTER TABLE public.jauge_etat
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 2. Drop old unique constraint and add new one including is_test
ALTER TABLE public.jauge_etat
  DROP CONSTRAINT IF EXISTS jauge_etat_entreprise_id_date_soiree_key;

ALTER TABLE public.jauge_etat
  ADD CONSTRAINT jauge_etat_entreprise_id_date_soiree_is_test_key
  UNIQUE (entreprise_id, date_soiree, is_test);

-- 3. Add is_test to jauge_actions
ALTER TABLE public.jauge_actions
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 4. Add force_session columns to entreprise
ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS force_session_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_session_type text,
  ADD COLUMN IF NOT EXISTS force_session_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS force_session_expires_at timestamptz;

-- 5. Update increment_jauge to support is_test
DROP FUNCTION IF EXISTS increment_jauge(uuid, integer, text, uuid);

CREATE OR REPLACE FUNCTION increment_jauge(
  p_entreprise_id uuid,
  p_delta         integer,
  p_source        text,
  p_user_id       uuid,
  p_is_test       boolean DEFAULT false
) RETURNS integer AS $$
DECLARE
  v_new integer;
BEGIN
  INSERT INTO jauge_etat (entreprise_id, count_actuel, date_soiree, is_test)
  VALUES (p_entreprise_id, GREATEST(0, p_delta), CURRENT_DATE, p_is_test)
  ON CONFLICT (entreprise_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel = GREATEST(0, jauge_etat.count_actuel + p_delta),
    updated_at   = now(),
    updated_by   = p_user_id::text;

  SELECT count_actuel INTO v_new
  FROM jauge_etat
  WHERE entreprise_id = p_entreprise_id
    AND date_soiree   = CURRENT_DATE
    AND is_test       = p_is_test;

  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by, is_test)
  VALUES (
    p_entreprise_id,
    CASE WHEN p_delta > 0 THEN 'entree' ELSE 'sortie' END,
    p_delta,
    p_source,
    p_user_id,
    p_is_test
  );

  RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update reset_jauge to support is_test
DROP FUNCTION IF EXISTS reset_jauge(uuid, uuid);

CREATE OR REPLACE FUNCTION reset_jauge(
  p_entreprise_id uuid,
  p_user_id       uuid,
  p_is_test       boolean DEFAULT false
) RETURNS integer AS $$
BEGIN
  INSERT INTO jauge_etat (entreprise_id, count_actuel, date_soiree, is_test)
  VALUES (p_entreprise_id, 0, CURRENT_DATE, p_is_test)
  ON CONFLICT (entreprise_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel = 0,
    updated_at   = now(),
    updated_by   = p_user_id::text;

  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by, is_test)
  VALUES (p_entreprise_id, 'reset', 0, 'app', p_user_id, p_is_test);

  RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update set_entrees_manuelles to support is_test
DROP FUNCTION IF EXISTS set_entrees_manuelles(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION set_entrees_manuelles(
  p_entreprise_id uuid,
  p_entrees       integer,
  p_user_id       uuid,
  p_is_test       boolean DEFAULT false
) RETURNS integer AS $$
DECLARE
  v_sorties    integer;
  v_new_count  integer;
BEGIN
  SELECT COALESCE(ABS(SUM(delta)), 0) INTO v_sorties
  FROM jauge_actions
  WHERE entreprise_id = p_entreprise_id
    AND action        = 'sortie'
    AND is_test       = p_is_test
    AND created_at::date = CURRENT_DATE;

  v_new_count := GREATEST(0, p_entrees - v_sorties);

  INSERT INTO jauge_etat (entreprise_id, count_actuel, date_soiree, is_test)
  VALUES (p_entreprise_id, v_new_count, CURRENT_DATE, p_is_test)
  ON CONFLICT (entreprise_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel = v_new_count,
    updated_at   = now(),
    updated_by   = p_user_id::text;

  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by, is_test)
  VALUES (p_entreprise_id, 'entree', p_entrees, 'manuel', p_user_id, p_is_test);

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create close_test_session RPC
CREATE OR REPLACE FUNCTION close_test_session(
  p_entreprise_id uuid
) RETURNS void AS $$
BEGIN
  DELETE FROM jauge_actions
  WHERE entreprise_id = p_entreprise_id
    AND is_test = true;

  DELETE FROM jauge_etat
  WHERE entreprise_id = p_entreprise_id
    AND is_test = true;

  UPDATE entreprise
  SET force_session_active     = false,
      force_session_type       = null,
      force_session_opened_at  = null,
      force_session_expires_at = null
  WHERE id = p_entreprise_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
