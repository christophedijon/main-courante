/*
  # Add carte professionnelle (CNAPS) fields to user_profiles

  1. Modified Tables
    - `user_profiles`
      - `carte_pro_numero` (text) — numéro CNAPS format CAR-XX-XXXX-XX-XX-XXXXXXXX
      - `carte_pro_validite` (date, nullable) — date de fin de validité

  2. Notes
    - Only shown/saved when the user's fonction is "Agent de Sécurité"
    - Existing RLS policies on user_profiles cover these new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_pro_numero') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_pro_numero text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'carte_pro_validite') THEN
    ALTER TABLE user_profiles ADD COLUMN carte_pro_validite date;
  END IF;
END $$;
