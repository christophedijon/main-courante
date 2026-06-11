ALTER TABLE public.entreprise
  ADD COLUMN IF NOT EXISTS frequence_billetterie integer DEFAULT 10;
