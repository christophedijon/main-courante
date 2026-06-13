-- Fix evenements RLS: restore simple authenticated policies
-- The strict scoped policy broke inserts because:
-- 1. evenements.etablissement_id may not be set or is a different UUID type
-- 2. Original design: all authenticated agents can create and view events
-- Restoring to original intent from 20260502004200 migration

-- Add etablissement_id column if it somehow doesn't exist (idempotent)
ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS etablissement_id uuid;

-- DROP all existing evenements INSERT/SELECT policies
DROP POLICY IF EXISTS "Authenticated can view evenements" ON public.evenements;
DROP POLICY IF EXISTS "Authenticated can insert evenements" ON public.evenements;
DROP POLICY IF EXISTS "evenements_insert_own_etab" ON public.evenements;
DROP POLICY IF EXISTS "evenements_select_own_etab" ON public.evenements;
DROP POLICY IF EXISTS "Super admins can update evenements" ON public.evenements;
DROP POLICY IF EXISTS "Super admins can delete evenements" ON public.evenements;

-- Recreate with simple, correct policies
CREATE POLICY "evenements_select_authenticated"
  ON public.evenements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "evenements_insert_authenticated"
  ON public.evenements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "evenements_update_super_admin"
  ON public.evenements FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE email = auth.email()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins WHERE email = auth.email()));

CREATE POLICY "evenements_delete_super_admin"
  ON public.evenements FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE email = auth.email()));

-- Fix evenement_motifs policies too (same pattern)
DROP POLICY IF EXISTS "Authenticated can view evenement_motifs" ON public.evenement_motifs;
DROP POLICY IF EXISTS "Authenticated can insert evenement_motifs" ON public.evenement_motifs;
DROP POLICY IF EXISTS "Super admins can delete evenement_motifs" ON public.evenement_motifs;

CREATE POLICY "evenement_motifs_select_authenticated"
  ON public.evenement_motifs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "evenement_motifs_insert_authenticated"
  ON public.evenement_motifs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "evenement_motifs_delete_super_admin"
  ON public.evenement_motifs FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE email = auth.email()));
