/*
  # Add siret, code_ape, horaires_ouverture, activites_reelles to entreprise

  1. Modified Table: `entreprise`
    - `siret` (text, default '') — numéro SIRET de l'entreprise
    - `code_ape` (text, default '') — code APE/NAF de l'activité
    - `horaires_ouverture` (jsonb, default '{}') — horaires d'ouverture par jour
    - `activites_reelles` (text[], default '{}') — liste des activités réelles exercées

  2. No RLS changes — table already has existing policies
*/

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS siret text DEFAULT '';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS code_ape text DEFAULT '';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS horaires_ouverture jsonb DEFAULT '{}';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS activites_reelles text[] DEFAULT '{}';
