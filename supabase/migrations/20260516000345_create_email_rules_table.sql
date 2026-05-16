/*
  # Create email_rules table

  ## Purpose
  Centralize all automatic email sending rules in one table.
  Replaces the old rapport_email_settings table for rapport rules
  and adds a new rule type for registre securite alerts.

  ## New Tables
  - `email_rules`
    - `id` (uuid, primary key)
    - `type` (text) — 'rapport_soiree' or 'registre_securite'
    - `label` (text) — custom display name
    - `active` (boolean) — enable/disable this rule
    - `dest_direction` (boolean) — send to users with fonction 'Direction'
    - `dest_chef_de_poste` (boolean) — send to 'Chef de Poste'
    - `dest_agent_securite` (boolean) — send to 'Agent de Sécurité'
    - `dest_serveur` (boolean) — send to 'Serveur'
    - `dest_email_organisme` (boolean) — send to email_organisme of each registre row (registre only)
    - `dest_emails_libres` (text[]) — free-form email addresses
    - `jours_avant_echeance` (int) — days before deadline to trigger alert (registre only)
    - `rappel_retard_frequence` (text) — 'quotidien' | 'hebdomadaire' | 'mensuel' (registre only, for overdue items)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Only super admins (via super_admins table) can read/write
*/

CREATE TABLE IF NOT EXISTS public.email_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('rapport_soiree', 'registre_securite')),
  label text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  dest_direction boolean NOT NULL DEFAULT false,
  dest_chef_de_poste boolean NOT NULL DEFAULT false,
  dest_agent_securite boolean NOT NULL DEFAULT false,
  dest_serveur boolean NOT NULL DEFAULT false,
  dest_email_organisme boolean NOT NULL DEFAULT false,
  dest_emails_libres text[] NOT NULL DEFAULT '{}',
  jours_avant_echeance integer NOT NULL DEFAULT 90,
  rappel_retard_frequence text NOT NULL DEFAULT 'hebdomadaire' CHECK (rappel_retard_frequence IN ('quotidien', 'hebdomadaire', 'mensuel')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can select email_rules"
  ON public.email_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Super admins can insert email_rules"
  ON public.email_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Super admins can update email_rules"
  ON public.email_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Super admins can delete email_rules"
  ON public.email_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Seed default rules
INSERT INTO public.email_rules (type, label, active, dest_direction, jours_avant_echeance, rappel_retard_frequence)
VALUES
  ('rapport_soiree', 'Rapport de soirée', false, true, 90, 'hebdomadaire'),
  ('registre_securite', 'Alertes registre de sécurité', false, true, 90, 'hebdomadaire')
ON CONFLICT DO NOTHING;
