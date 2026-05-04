/*
  # Add telephone and nationalite to user_profiles

  1. Modified Tables
    - `user_profiles`
      - `telephone` (text, default '') — user's phone number
      - `nationalite` (text, default '') — user's nationality

  2. No security changes (RLS already enabled with existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'telephone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN telephone text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'nationalite'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN nationalite text NOT NULL DEFAULT '';
  END IF;
END $$;
