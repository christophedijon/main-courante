/*
  # Add organisme confirmation fields to registre_securite

  1. New Columns
    - `confirmation_token` (uuid) — unique token per row for organisme confirmation link
    - `confirme_par_organisme` (boolean, default false) — whether organisme confirmed
    - `confirme_at` (timestamptz) — timestamp of confirmation
    - `confirme_organisme_email` (text) — email address that confirmed

  2. Index
    - Fast lookup by confirmation_token for the confirm-registre edge function
*/

ALTER TABLE registre_securite
  ADD COLUMN IF NOT EXISTS confirmation_token      uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS confirme_par_organisme  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirme_at             timestamptz,
  ADD COLUMN IF NOT EXISTS confirme_organisme_email text;

CREATE INDEX IF NOT EXISTS idx_registre_confirmation_token
  ON registre_securite(confirmation_token);
