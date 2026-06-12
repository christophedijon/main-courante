ALTER TABLE public.jauge_etat
  ADD COLUMN IF NOT EXISTS entrees_max_zapsis integer DEFAULT 0;