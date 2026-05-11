/*
  # Ajout de zone_ssi_id dans la table evenements

  ## Contexte
  Les zones SSI ont été migrées vers une table dédiée `zones_ssi`,
  indépendante de la table `zones`. Les événements SSI stockaient
  leur zone via `zone_id` (FK vers `zones`), ce qui causait une
  violation de contrainte FK car les zones SSI n'existent plus dans
  `zones`.

  ## Changements
  1. Nouvelle colonne `zone_ssi_id` (uuid, nullable)
     - Clé étrangère vers `zones_ssi(id)` avec ON DELETE SET NULL
     - Utilisée exclusivement pour les événements de type SSI

  2. Comportement
     - Événements SSI    → zone_id = null, zone_ssi_id = id de la zone SSI
     - Événements Terrain → zone_id = id de la zone, zone_ssi_id = null

  ## Notes
  - Utilise IF NOT EXISTS pour idempotence
  - Aucune donnée existante n'est modifiée
*/

ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS zone_ssi_id uuid REFERENCES public.zones_ssi(id) ON DELETE SET NULL;
