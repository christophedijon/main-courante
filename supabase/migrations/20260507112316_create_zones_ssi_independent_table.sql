/*
  # Create independent zones_ssi table

  ## Summary
  Separates SSI fire-safety zones from the general zones table into their own
  independent table with no dependency on espaces/salles.

  ## New Tables
  - `zones_ssi`
    - `id` (uuid, primary key)
    - `nom` (text, required)
    - `description` (text, default empty)
    - `actif` (boolean, default true)
    - `ordre` (integer, default 0 — for display ordering)
    - `created_at` / `updated_at` (timestamps)

  ## Data Migration
  - Existing SSI zones from `zones` table (categorie = 'ssi') are copied into `zones_ssi`
  - SSI rows are then deleted from `zones`

  ## Security
  - RLS enabled on `zones_ssi`
  - All authenticated users can SELECT (needed for mobile saisie)
  - All authenticated users can INSERT / UPDATE / DELETE (admins manage via back-office,
    no further row-level restriction beyond authentication)
*/

CREATE TABLE IF NOT EXISTS public.zones_ssi (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  actif       boolean     NOT NULL DEFAULT true,
  ordre       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zones_ssi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zones_ssi_select"
  ON public.zones_ssi FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "zones_ssi_insert"
  ON public.zones_ssi FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "zones_ssi_update"
  ON public.zones_ssi FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "zones_ssi_delete"
  ON public.zones_ssi FOR DELETE
  TO authenticated USING (true);

-- Migrate existing SSI zones from the zones table
INSERT INTO public.zones_ssi (nom, description, actif, ordre)
SELECT nom, COALESCE(description, ''), true, 0
FROM public.zones
WHERE categorie = 'ssi';

-- Remove SSI rows from the zones table (no longer needed there)
DELETE FROM public.zones WHERE categorie = 'ssi';
