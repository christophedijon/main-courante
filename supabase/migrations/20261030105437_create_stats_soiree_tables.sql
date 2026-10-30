/*
# Tables des statistiques de soirée

1. Nouvelles tables
- `stats_soiree` : une ligne par établissement et par soirée (période 08:00 -> 08:00 heure de Paris, identifiée par `date_soiree`).
  - `jour_semaine` (1 = lundi ... 7 = dimanche), `visiteurs`, `pic_debut` / `pic_fin` (HH:MM), `pic_entrees`,
    `nb_evenements`, `evenements_par_categorie` (nombre d'événements par type), `nb_snapshots`,
    `mode_jauge`, `source_visiteurs` ('zapsis' en mode automatique, 'manuel' sinon), `saut_detecte`, `calculated_at`.
- `stats_soiree_heures` : entrées par heure (heure de Paris 0 à 23) pour chaque soirée en mode automatique.

2. Sécurité
- RLS activé sur les deux tables.
- Lecture pour les utilisateurs de rôle « Direction » de l'établissement concerné, uniquement via `authenticated`.
- Aucune politique pour SuperAdmin et MegaAdmin.
- Écriture réservée à service_role (aucun droit d'écriture pour anon ni authenticated).

3. Notes
- Les données sont dérivées : elles sont entièrement recalculées par la fonction de calcul, sans modifier les données sources.
*/

CREATE TABLE IF NOT EXISTS public.stats_soiree (
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  date_soiree date NOT NULL,
  jour_semaine smallint NOT NULL CHECK (jour_semaine BETWEEN 1 AND 7),
  visiteurs integer NOT NULL DEFAULT 0,
  pic_debut text,
  pic_fin text,
  pic_entrees integer,
  nb_evenements integer NOT NULL DEFAULT 0,
  evenements_par_categorie jsonb NOT NULL DEFAULT '{}'::jsonb,
  nb_snapshots integer NOT NULL DEFAULT 0,
  mode_jauge text NOT NULL,
  source_visiteurs text NOT NULL CHECK (source_visiteurs IN ('zapsis', 'manuel')),
  saut_detecte boolean NOT NULL DEFAULT false,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (etablissement_id, date_soiree)
);

CREATE TABLE IF NOT EXISTS public.stats_soiree_heures (
  etablissement_id uuid NOT NULL,
  date_soiree date NOT NULL,
  heure_paris smallint NOT NULL CHECK (heure_paris BETWEEN 0 AND 23),
  entrees integer NOT NULL DEFAULT 0,
  PRIMARY KEY (etablissement_id, date_soiree, heure_paris),
  FOREIGN KEY (etablissement_id, date_soiree)
    REFERENCES public.stats_soiree (etablissement_id, date_soiree) ON DELETE CASCADE
);

ALTER TABLE public.stats_soiree ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stats_soiree_heures ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.stats_soiree, public.stats_soiree_heures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stats_soiree, public.stats_soiree_heures TO service_role;

DROP POLICY IF EXISTS "Direction lit les statistiques de soirée de son établissement" ON public.stats_soiree;
CREATE POLICY "Direction lit les statistiques de soirée de son établissement"
ON public.stats_soiree FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managed_users mu
    WHERE mu.auth_user_id = auth.uid()
      AND mu.etablissement_id = stats_soiree.etablissement_id
      AND mu.fonction = 'Direction'
  )
);

DROP POLICY IF EXISTS "Direction lit les heures de soirée de son établissement" ON public.stats_soiree_heures;
CREATE POLICY "Direction lit les heures de soirée de son établissement"
ON public.stats_soiree_heures FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.managed_users mu
    WHERE mu.auth_user_id = auth.uid()
      AND mu.etablissement_id = stats_soiree_heures.etablissement_id
      AND mu.fonction = 'Direction'
  )
);
