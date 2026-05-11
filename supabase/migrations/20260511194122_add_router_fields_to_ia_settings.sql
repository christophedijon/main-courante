/*
  # Ajout des champs routeur IA dans ia_settings

  1. Nouvelles colonnes
    - `prompt_router` (text) — Prompt système utilisé par le modèle rapide
      pour détecter automatiquement quel(s) expert(s) activer.
      Doit retourner un tableau JSON comme ["terrain"] ou ["terrain","erp"].
    - `gpt_model_router` (text) — Modèle GPT utilisé pour le routage.
      Par défaut gpt-3.5-turbo (rapide et économique).

  2. Notes
    - Colonnes ajoutées avec IF NOT EXISTS pour idempotence
    - Valeurs par défaut conservatrices (chaîne vide / gpt-3.5-turbo)
*/

ALTER TABLE public.ia_settings
  ADD COLUMN IF NOT EXISTS prompt_router text DEFAULT '';

ALTER TABLE public.ia_settings
  ADD COLUMN IF NOT EXISTS gpt_model_router text DEFAULT 'gpt-3.5-turbo';
