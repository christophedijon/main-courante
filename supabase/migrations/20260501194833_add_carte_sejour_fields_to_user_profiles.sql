/*
  # Add carte de séjour fields to user_profiles

  1. Modified Tables
    - `user_profiles`
      - `carte_sejour_numero` (text) — numéro de la carte de séjour
      - `carte_sejour_validite` (date, nullable) — date de fin de validité
      - `carte_sejour_recto_url` (text, nullable) — URL publique photo recto
      - `carte_sejour_recto_path` (text, nullable) — chemin Storage recto
      - `carte_sejour_verso_url` (text, nullable) — URL publique photo verso
      - `carte_sejour_verso_path` (text, nullable) — chemin Storage verso

  2. Notes
    - Only visible/editable when nationalite is not EEE/Suisse/Française
    - No new RLS policies needed — existing user_profiles policies cover these columns
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_sejour_numero') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_sejour_numero text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_sejour_validite') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_sejour_validite date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_sejour_recto_url') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_sejour_recto_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_sejour_recto_path') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_sejour_recto_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_sejour_verso_url') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_sejour_verso_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_sejour_verso_path') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_sejour_verso_path text;
  END IF;
END $$;
