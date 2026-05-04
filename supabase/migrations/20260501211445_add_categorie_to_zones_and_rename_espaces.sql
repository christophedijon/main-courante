/*
  # Add categorie to zones table

  ## Changes
  - `zones` table: add `categorie` column to distinguish between:
    - 'securite_personnes' — Zone sécurité des personnes
    - 'ssi'               — Sécurité Incendie SSI

  ## Notes
  - Existing zones without a categorie default to 'securite_personnes'
  - The `espaces` table remains the same (renamed "Espace ou salle" is only a UI label)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zones' AND column_name = 'categorie'
  ) THEN
    ALTER TABLE zones ADD COLUMN categorie text NOT NULL DEFAULT 'securite_personnes';
  END IF;
END $$;
