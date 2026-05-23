/*
  # Add enseigne and email columns to entreprise

  1. Changes
    - `entreprise.enseigne` (text, nullable) — commercial name / trading name
    - `entreprise.email`    (text, nullable) — contact email address
  Both columns are optional and default to NULL.
*/

ALTER TABLE entreprise ADD COLUMN IF NOT EXISTS enseigne text;
ALTER TABLE entreprise ADD COLUMN IF NOT EXISTS email    text;
