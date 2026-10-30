/*
# Baromètre réseau : fonctions de tendance

1. Nouvelles fonctions
- `tendance_etablissement(p_etablissement_id, p_date_soiree)` : compare le nombre de visiteurs d'une soirée à celui de la même soirée une semaine plus tôt. Renvoie 'hausse', 'baisse', 'stable', ou NULL si une des deux soirées est absente ou à 0 visiteur.
- `tendance_reseau(p_etablissement_id, p_date_soiree)` : compare un établissement à la médiane des variations de la cohorte du réseau pour la même soirée.

2. Règles de la tendance
- Seuils : hausse si la variation est strictement supérieure à +10 %, baisse si strictement inférieure à -10 %, stable sinon (une variation de exactement +10 % ou -10 % est stable).
- Cohorte du réseau : établissements hors test, statut 'essai' ou 'actif', participant au baromètre, avec plus de 0 visiteur aux deux dates.
- Cohorte de moins de 5 établissements : NULL. Le nombre d'établissements n'est jamais renvoyé.
- `tendance_reseau` renvoie NULL si l'établissement demandé ne participe pas au baromètre.

3. Sécurité
- Les deux fonctions sont SECURITY DEFINER avec un search_path fixé.
- EXECUTE est retiré à PUBLIC, anon et authenticated. Seul service_role peut les appeler (et le propriétaire de la base).
- Aucune donnée n'est écrite par ces fonctions.

4. Notes
- Aucune table, politique ou rapport existant n'est modifié.
*/

CREATE OR REPLACE FUNCTION public.tendance_etablissement(p_etablissement_id uuid, p_date_soiree date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actuel integer;
  v_precedent integer;
  v_variation numeric;
BEGIN
  SELECT s.visiteurs INTO v_actuel
  FROM public.stats_soiree s
  WHERE s.etablissement_id = p_etablissement_id
    AND s.date_soiree = p_date_soiree;

  SELECT s.visiteurs INTO v_precedent
  FROM public.stats_soiree s
  WHERE s.etablissement_id = p_etablissement_id
    AND s.date_soiree = p_date_soiree - 7;

  IF COALESCE(v_actuel, 0) = 0 OR COALESCE(v_precedent, 0) = 0 THEN
    RETURN NULL;
  END IF;

  v_variation := (v_actuel - v_precedent)::numeric / v_precedent * 100;

  RETURN CASE
    WHEN v_variation > 10 THEN 'hausse'
    WHEN v_variation < -10 THEN 'baisse'
    ELSE 'stable'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.tendance_reseau(p_etablissement_id uuid, p_date_soiree date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participe boolean;
  v_nombre integer;
  v_mediane double precision;
  v_tendance_etablissement text;
BEGIN
  SELECT e.barometre_participe INTO v_participe
  FROM public.etablissements e
  WHERE e.id = p_etablissement_id;

  IF NOT COALESCE(v_participe, false) THEN
    RETURN NULL;
  END IF;

  WITH cohorte AS (
    SELECT (s1.visiteurs - s0.visiteurs)::numeric / s0.visiteurs * 100 AS variation
    FROM public.stats_soiree s1
    JOIN public.stats_soiree s0
      ON s0.etablissement_id = s1.etablissement_id
     AND s0.date_soiree = p_date_soiree - 7
    JOIN public.etablissements e
      ON e.id = s1.etablissement_id
    WHERE s1.date_soiree = p_date_soiree
      AND s1.visiteurs > 0
      AND s0.visiteurs > 0
      AND e.est_test = false
      AND e.statut IN ('essai', 'actif')
      AND e.barometre_participe = true
  )
  SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY variation)
  INTO v_nombre, v_mediane
  FROM cohorte;

  IF v_nombre < 5 THEN
    RETURN NULL;
  END IF;

  RETURN CASE
    WHEN v_mediane > 10 THEN 'hausse'
    WHEN v_mediane < -10 THEN 'baisse'
    ELSE 'stable'
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tendance_etablissement(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tendance_etablissement(uuid, date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.tendance_reseau(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tendance_reseau(uuid, date) TO service_role;
