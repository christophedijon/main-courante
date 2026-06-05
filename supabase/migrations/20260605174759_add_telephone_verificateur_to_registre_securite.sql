ALTER TABLE public.registre_securite
  ADD COLUMN IF NOT EXISTS telephone_verificateur text DEFAULT '';
