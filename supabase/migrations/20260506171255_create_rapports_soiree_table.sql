/*
  # Création de la table rapports_soiree

  ## Objectif
  Stocker les rapports automatiques générés chaque matin à 8h00 pour la soirée précédente
  (de J-1 15h00 à J 07h00).

  ## Nouvelle table : rapports_soiree
  - `id` : identifiant unique UUID
  - `date_soiree` : date de la soirée (date du soir, ex: 2026-05-05)
  - `debut_soiree` : timestamp exact de début (J-1 15:00)
  - `fin_soiree` : timestamp exact de fin (J 07:00)
  - `nb_evenements` : nombre total d'événements sur la soirée
  - `nb_agents` : nombre d'agents uniques ayant déclaré des événements
  - `contenu_html` : rapport complet au format HTML
  - `created_at` : timestamp de génération

  ## Contrainte d'unicité
  Un seul rapport par `date_soiree` (évite les doublons en cas de relance).

  ## Sécurité RLS
  - SELECT : tous les utilisateurs authentifiés
  - INSERT : uniquement via service_role (edge function) — pas de politique INSERT authenticated
    car la génération est automatique côté serveur
*/

CREATE TABLE IF NOT EXISTS public.rapports_soiree (
  id            uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  date_soiree   date            NOT NULL UNIQUE,
  debut_soiree  timestamptz     NOT NULL,
  fin_soiree    timestamptz     NOT NULL,
  nb_evenements integer         DEFAULT 0,
  nb_agents     integer         DEFAULT 0,
  contenu_html  text,
  created_at    timestamptz     DEFAULT now()
);

ALTER TABLE public.rapports_soiree ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rapports"
  ON public.rapports_soiree
  FOR SELECT
  TO authenticated
  USING (true);

-- Index pour accès rapide par date
CREATE INDEX IF NOT EXISTS rapports_soiree_date_idx
  ON public.rapports_soiree (date_soiree DESC);
