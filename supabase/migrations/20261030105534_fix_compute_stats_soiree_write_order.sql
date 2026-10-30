/*
# Correction de l'ordre d'écriture dans compute_stats_soiree

1. Modification
- La fonction `compute_stats_soiree` écrit désormais la ligne de `stats_soiree` avant les lignes de `stats_soiree_heures`
  (corrige une violation de clé étrangère à la première exécution).
- Aucune table ni donnée source n'est modifiée ; la logique de calcul reste identique.

2. Sécurité
- Les droits EXECUTE restent limités à service_role et postgres.
*/

CREATE OR REPLACE FUNCTION public.compute_stats_soiree(p_etablissement_id uuid, p_date_soiree date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_debut timestamptz;
  v_fin timestamptz;
  v_mode text;
  v_auto boolean;
  v_visiteurs integer;
  v_nb_evenements integer;
  v_categories jsonb;
  v_nb_snapshots integer;
  v_pic_debut timestamptz;
  v_pic_entrees integer;
  v_saut boolean := false;
BEGIN
  SELECT p.debut, p.fin INTO v_debut, v_fin FROM public.periode_rapport(p_date_soiree) p;

  SELECT e.mode_jauge INTO v_mode FROM public.etablissements e WHERE e.id = p_etablissement_id;
  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'Etablissement introuvable ou sans mode de jauge: %', p_etablissement_id;
  END IF;
  v_auto := v_mode = 'automatique';

  SELECT count(*)::integer INTO v_nb_evenements
  FROM public.evenements ev
  WHERE ev.etablissement_id = p_etablissement_id
    AND ev.date_evenement >= v_debut AND ev.date_evenement < v_fin;

  SELECT coalesce(jsonb_object_agg(c.categorie, c.n), '{}'::jsonb) INTO v_categories
  FROM (
    SELECT coalesce(ev.type, 'autre') AS categorie, count(*)::integer AS n
    FROM public.evenements ev
    WHERE ev.etablissement_id = p_etablissement_id
      AND ev.date_evenement >= v_debut AND ev.date_evenement < v_fin
    GROUP BY 1
  ) c;

  SELECT count(*)::integer INTO v_nb_snapshots
  FROM public.jauge_snapshots s
  WHERE s.etablissement_id = p_etablissement_id
    AND s.snapshot_at >= v_debut AND s.snapshot_at < v_fin;

  IF v_auto THEN
    SELECT coalesce(je.entrees_billetterie, 0) INTO v_visiteurs
    FROM public.jauge_etat je
    WHERE je.etablissement_id = p_etablissement_id
      AND je.date_soiree = p_date_soiree
      AND je.is_test IS NOT TRUE;
    v_visiteurs := coalesce(v_visiteurs, 0);
  ELSE
    SELECT coalesce(sum(ja.delta), 0)::integer INTO v_visiteurs
    FROM public.jauge_actions ja
    WHERE ja.etablissement_id = p_etablissement_id
      AND ja.action = 'entree'
      AND ja.is_test IS NOT TRUE
      AND ja.created_at >= v_debut AND ja.created_at < v_fin;
  END IF;

  IF v_auto AND v_nb_snapshots > 0 THEN
    WITH s AS (
      SELECT s.snapshot_at AS t, coalesce(s.entrees_billetterie, 0) AS e
      FROM public.jauge_snapshots s
      WHERE s.etablissement_id = p_etablissement_id
        AND s.snapshot_at >= v_debut AND s.snapshot_at < v_fin
    ),
    deltas AS (
      SELECT t, e - lag(e) OVER (ORDER BY t) AS delta, t - lag(t) OVER (ORDER BY t) AS intervalle
      FROM s
    )
    SELECT coalesce(bool_or(d.delta > 100 AND d.intervalle <= interval '4 minutes'), false)
    INTO v_saut
    FROM deltas d;
  END IF;

  IF v_auto AND v_nb_snapshots >= 10 THEN
    WITH s AS (
      SELECT s.snapshot_at AS t, coalesce(s.entrees_billetterie, 0) AS e
      FROM public.jauge_snapshots s
      WHERE s.etablissement_id = p_etablissement_id
        AND s.snapshot_at >= v_debut AND s.snapshot_at < v_fin
    ),
    fenetres AS (
      SELECT i.t AS debut,
             (SELECT j.e FROM s j WHERE j.t <= i.t + interval '1 hour' ORDER BY j.t DESC LIMIT 1) AS e_fin,
             i.e AS e_debut
      FROM s i
      WHERE i.t + interval '1 hour' <= (SELECT max(x.t) FROM s x)
    )
    SELECT f.debut, (f.e_fin - f.e_debut)
    INTO v_pic_debut, v_pic_entrees
    FROM fenetres f
    WHERE f.e_fin IS NOT NULL
    ORDER BY (f.e_fin - f.e_debut) DESC, f.debut ASC
    LIMIT 1;
  END IF;

  INSERT INTO public.stats_soiree (
    etablissement_id, date_soiree, jour_semaine, visiteurs,
    pic_debut, pic_fin, pic_entrees,
    nb_evenements, evenements_par_categorie, nb_snapshots,
    mode_jauge, source_visiteurs, saut_detecte, calculated_at
  ) VALUES (
    p_etablissement_id,
    p_date_soiree,
    extract(isodow FROM p_date_soiree)::smallint,
    v_visiteurs,
    CASE WHEN v_pic_debut IS NULL THEN NULL ELSE to_char(v_pic_debut AT TIME ZONE 'Europe/Paris', 'HH24:MI') END,
    CASE WHEN v_pic_debut IS NULL THEN NULL ELSE to_char((v_pic_debut + interval '1 hour') AT TIME ZONE 'Europe/Paris', 'HH24:MI') END,
    v_pic_entrees,
    v_nb_evenements,
    coalesce(v_categories, '{}'::jsonb),
    v_nb_snapshots,
    v_mode,
    CASE WHEN v_auto THEN 'zapsis' ELSE 'manuel' END,
    v_saut,
    now()
  )
  ON CONFLICT (etablissement_id, date_soiree) DO UPDATE SET
    jour_semaine = EXCLUDED.jour_semaine,
    visiteurs = EXCLUDED.visiteurs,
    pic_debut = EXCLUDED.pic_debut,
    pic_fin = EXCLUDED.pic_fin,
    pic_entrees = EXCLUDED.pic_entrees,
    nb_evenements = EXCLUDED.nb_evenements,
    evenements_par_categorie = EXCLUDED.evenements_par_categorie,
    nb_snapshots = EXCLUDED.nb_snapshots,
    mode_jauge = EXCLUDED.mode_jauge,
    source_visiteurs = EXCLUDED.source_visiteurs,
    saut_detecte = EXCLUDED.saut_detecte,
    calculated_at = EXCLUDED.calculated_at;

  DELETE FROM public.stats_soiree_heures h
  WHERE h.etablissement_id = p_etablissement_id AND h.date_soiree = p_date_soiree;

  IF v_auto AND v_nb_snapshots > 0 THEN
    INSERT INTO public.stats_soiree_heures (etablissement_id, date_soiree, heure_paris, entrees)
    WITH s AS (
      SELECT s.snapshot_at AS t, coalesce(s.entrees_billetterie, 0) AS e
      FROM public.jauge_snapshots s
      WHERE s.etablissement_id = p_etablissement_id
        AND s.snapshot_at >= v_debut AND s.snapshot_at < v_fin
    ),
    deltas AS (
      SELECT t, e - lag(e) OVER (ORDER BY t) AS delta FROM s
    )
    SELECT p_etablissement_id, p_date_soiree,
           extract(hour FROM d.t AT TIME ZONE 'Europe/Paris')::smallint,
           sum(d.delta)::integer
    FROM deltas d
    WHERE d.delta > 0
    GROUP BY 3;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_stats_soiree(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_stats_soiree(uuid, date) TO service_role, postgres;
