ALTER TABLE public.registre_signatures
  ADD COLUMN IF NOT EXISTS verificateur_nom text DEFAULT '',
  ADD COLUMN IF NOT EXISTS verificateur_organisme text DEFAULT '',
  ADD COLUMN IF NOT EXISTS verificateur_contact text DEFAULT '',
  ADD COLUMN IF NOT EXISTS observations_signature text DEFAULT '';

ALTER TABLE public.registre_securite
  ADD COLUMN IF NOT EXISTS reprise_papier boolean DEFAULT false;
