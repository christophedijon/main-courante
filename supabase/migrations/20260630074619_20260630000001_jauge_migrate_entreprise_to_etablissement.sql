-- ══════════════════════════════════════════════════════════════════
-- FIX URGENT : jauge_etat + jauge_actions → entreprise_id → etablissement_id
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Migrer les données existantes ──────────────────────────────
UPDATE jauge_etat je
SET etablissement_id = et.id
FROM etablissements et
WHERE je.etablissement_id IS NULL
  AND et.nom = (SELECT nom FROM entreprise WHERE id = je.entreprise_id LIMIT 1);

UPDATE jauge_actions ja
SET etablissement_id = et.id
FROM etablissements et
WHERE ja.etablissement_id IS NULL
  AND et.nom = (SELECT nom FROM entreprise WHERE id = ja.entreprise_id LIMIT 1);

-- ── 2. Supprimer les UNIQUE constraints dupliquées sur entreprise_id ──
ALTER TABLE jauge_etat DROP CONSTRAINT IF EXISTS jauge_etat_entreprise_id_date_soiree_is_test_key;
ALTER TABLE jauge_etat DROP CONSTRAINT IF EXISTS jauge_etat_unique_per_session;

-- ── 3. Ajouter UNIQUE sur etablissement_id ───────────────────────
ALTER TABLE jauge_etat
  ADD CONSTRAINT jauge_etat_unique_per_session
  UNIQUE (etablissement_id, date_soiree, is_test);

-- ── 4. DROP des anciennes signatures RPC (noms de paramètres incompatibles) ──
DROP FUNCTION IF EXISTS public.increment_jauge(uuid, integer, text, uuid, boolean);
DROP FUNCTION IF EXISTS public.reset_jauge(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.set_entrees_manuelles(uuid, integer, uuid, boolean);

-- ── 5. Réécrire increment_jauge ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_jauge(
  p_etablissement_id uuid,
  p_delta            integer,
  p_source           text,
  p_user_id          uuid,
  p_is_test          boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new integer;
BEGIN
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
$$;

-- ── 6. Réécrire reset_jauge ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_jauge(
  p_etablissement_id uuid,
  p_user_id          uuid,
  p_is_test          boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
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
$$;

-- ── 7. Réécrire set_entrees_manuelles ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_entrees_manuelles(
  p_etablissement_id uuid,
  p_entrees          integer,
  p_user_id          uuid,
  p_is_test          boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sorties   integer;
  v_new_count integer;
BEGIN
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
$$;
