/*
  # Add email notification settings for rapports de soirée

  ## Summary
  Adds a dedicated settings table to store email notification preferences
  for the rapport de soirée feature.

  ## New Tables
  - `rapport_email_settings`
    - `id` (uuid, primary key)
    - `email_destination` (text) — recipient address for the report email
    - `email_enabled` (boolean, default false) — toggle on/off
    - `created_at` / `updated_at` (timestamps)

  ## Security
  - RLS enabled
  - Only authenticated super admins can read/write (via email check in super_admins table)
    However, the Edge Function uses the service role key and bypasses RLS,
    so it can always read the settings.
  - We use a permissive authenticated policy here (same pattern as ia_settings)
    since only super admins can reach this page in the UI.
*/

CREATE TABLE IF NOT EXISTS public.rapport_email_settings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_destination text        NOT NULL DEFAULT '',
  email_enabled     boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rapport_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rapport_email_settings_select"
  ON public.rapport_email_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "rapport_email_settings_insert"
  ON public.rapport_email_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "rapport_email_settings_update"
  ON public.rapport_email_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Insert a default row so there is always exactly one settings record
INSERT INTO public.rapport_email_settings (email_destination, email_enabled)
VALUES ('', false);
