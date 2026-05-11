/*
  # Ajout des prompts Expert ERP et Expert Bruit dans ia_settings

  ## Nouvelles colonnes
  - `prompt_erp` (text) : Prompt système pour l'assistant Expert réglementation ERP
  - `gpt_model_erp` (text) : Modèle GPT utilisé pour l'expert ERP (défaut : gpt-4o)
  - `prompt_bruit` (text) : Prompt système pour l'assistant Expert bruit et acoustique
  - `gpt_model_bruit` (text) : Modèle GPT utilisé pour l'expert bruit (défaut : gpt-4o)
*/

ALTER TABLE public.ia_settings
  ADD COLUMN IF NOT EXISTS prompt_erp text DEFAULT '';

ALTER TABLE public.ia_settings
  ADD COLUMN IF NOT EXISTS gpt_model_erp text DEFAULT 'gpt-4o';

ALTER TABLE public.ia_settings
  ADD COLUMN IF NOT EXISTS prompt_bruit text DEFAULT '';

ALTER TABLE public.ia_settings
  ADD COLUMN IF NOT EXISTS gpt_model_bruit text DEFAULT 'gpt-4o';
