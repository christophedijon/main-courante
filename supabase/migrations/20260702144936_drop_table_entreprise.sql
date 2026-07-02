-- Drop FK constraints pointing to entreprise
ALTER TABLE jauge_etat DROP CONSTRAINT IF EXISTS jauge_etat_entreprise_id_fkey;
ALTER TABLE jauge_actions DROP CONSTRAINT IF EXISTS jauge_actions_entreprise_id_fkey;
ALTER TABLE editor_sessions DROP CONSTRAINT IF EXISTS editor_sessions_entreprise_id_fkey;

-- Drop the table
DROP TABLE IF EXISTS entreprise;
