/*
  # Rename role to fonction with new values

  ## Changes
  - Renames the `role` column to `fonction` on `managed_users`
  - Updates the default value to 'Agent de Sécurité'
  - Migrates existing data: 'user' → 'Agent de Sécurité', 'editor' → 'Serveur', 'manager' → 'Direction'

  ## Notes
  1. The three allowed values are: 'Agent de Sécurité', 'Serveur', 'Direction'
  2. 'Direction' carries super-admin level access rights in the future application
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'managed_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE managed_users RENAME COLUMN role TO fonction;
  END IF;
END $$;

ALTER TABLE managed_users
  ALTER COLUMN fonction SET DEFAULT 'Agent de Sécurité';

-- Migrate any legacy values
UPDATE managed_users SET fonction = 'Agent de Sécurité' WHERE fonction IN ('user', 'Agent de Sécurité');
UPDATE managed_users SET fonction = 'Serveur'           WHERE fonction = 'editor';
UPDATE managed_users SET fonction = 'Direction'         WHERE fonction = 'manager';
