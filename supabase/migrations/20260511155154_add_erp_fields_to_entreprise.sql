/*
  # Ajout des champs ERP à la table entreprise

  ## Nouvelles colonnes
  - `type_erp` (text) : Type d'établissement ERP selon la nomenclature officielle (J, L, M, N, O, P…)
  - `categorie_erp` (integer) : Catégorie ERP selon la capacité d'accueil (1 à 5)
  - `effectif_public` (integer) : Effectif admissible du public
  - `effectif_personnel` (integer) : Effectif du personnel permanent

  ## Valeurs par défaut
  - type_erp : 'P' (Salles de danse/discothèques)
  - categorie_erp : 4
  - effectif_public : 0
  - effectif_personnel : 0
*/

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS type_erp text DEFAULT 'P';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS categorie_erp integer DEFAULT 4;

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS effectif_public integer DEFAULT 0;

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS effectif_personnel integer DEFAULT 0;
