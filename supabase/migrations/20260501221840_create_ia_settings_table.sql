/*
  # Create ia_settings table

  1. New Tables
    - `ia_settings`
      - `id` (uuid, primary key)
      - `prompt` (text) — the system prompt text for the AI
      - `openai_api_key` (text) — the OpenAI API key
      - `gpt_model` (text) — selected GPT model (default: gpt-4o)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Only super_admins (by email match) can SELECT, INSERT, UPDATE
    - No DELETE allowed (single-row config table)

  3. Notes
    - Single-row config table; upsert via the application
    - API key is stored server-side, only accessible to super admins
*/

CREATE TABLE IF NOT EXISTS ia_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL DEFAULT '',
  openai_api_key text NOT NULL DEFAULT '',
  gpt_model text NOT NULL DEFAULT 'gpt-4o',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ia_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view ia settings"
  ON ia_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Super admins can insert ia settings"
  ON ia_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Super admins can update ia settings"
  ON ia_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
