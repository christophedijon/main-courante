ALTER TABLE public.entreprise
  DROP CONSTRAINT IF EXISTS entreprise_mode_jauge_check;
ALTER TABLE public.entreprise
  ADD CONSTRAINT entreprise_mode_jauge_check
  CHECK (mode_jauge IN ('entree_sortie', 'sortie', 'automatique'));

ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS url_billetterie text DEFAULT '';
