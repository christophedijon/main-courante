
-- Nouveau RPC sync_jauge_zapsis
-- Remplace la logique init/increment de poll-billetterie par un calcul absolu :
--   count_actuel = GREATEST(0, entrees_zapsis - sorties_flic_aujourd_hui)
-- Idempotent : toujours convergent vers la vérité Zapsis, immune aux saisies manuelles.

CREATE OR REPLACE FUNCTION public.sync_jauge_zapsis(
  p_etablissement_id uuid,
  p_entrees          integer,        -- total cumulatif Zapsis pour aujourd'hui
  p_is_test          boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sorties   integer;
  v_new_count integer;
BEGIN
  -- Sorties flic/agent enregistrées aujourd'hui (valeur absolue)
  SELECT COALESCE(SUM(ABS(delta)), 0) INTO v_sorties
  FROM jauge_actions
  WHERE etablissement_id = p_etablissement_id
    AND action            = 'sortie'
    AND is_test           = p_is_test
    AND created_at::date  = CURRENT_DATE;

  v_new_count := GREATEST(0, p_entrees - v_sorties);

  INSERT INTO jauge_etat (etablissement_id, count_actuel, date_soiree, is_test, entrees_max_zapsis)
  VALUES (p_etablissement_id, v_new_count, CURRENT_DATE, p_is_test, p_entrees)
  ON CONFLICT (etablissement_id, date_soiree, is_test)
  DO UPDATE SET
    count_actuel       = v_new_count,
    entrees_max_zapsis = GREATEST(jauge_etat.entrees_max_zapsis, p_entrees),
    updated_at         = now();

  RETURN v_new_count;
END;
$$;
