/*
  # Ajout du questionnaire réglementaire et document obligations dans entreprise

  ## Nouvelles colonnes
  - `activite_principale` (text) : Type ERP principal (P, N, L, O…)
  - `activites_complementaires` (jsonb) : Liste des types ERP complémentaires
  - `licence_boissons` (text) : Type de licence débit de boissons
  - `questionnaire_reponses` (jsonb) : Réponses complètes au questionnaire réglementaire
  - `derniere_visite_commission` (date) : Date de la dernière visite de la commission de sécurité
  - `document_obligations_html` (text) : Document "Mes obligations" généré par IA
  - `document_obligations_updated_at` (timestamptz) : Date de dernière génération du document

  ## Notes
  - categorie_erp, effectif_public, effectif_personnel déjà ajoutées dans une migration précédente
  - Utilisation de IF NOT EXISTS pour toutes les colonnes
*/

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS activite_principale text DEFAULT 'P';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS activites_complementaires jsonb DEFAULT '[]';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS licence_boissons text DEFAULT '';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS questionnaire_reponses jsonb DEFAULT '{}';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS derniere_visite_commission date;

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS document_obligations_html text DEFAULT '';

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS document_obligations_updated_at timestamptz;
