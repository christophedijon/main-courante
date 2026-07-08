-- Fix existing row that has NULL etablissement_id
UPDATE rapports_soiree
SET etablissement_id = 'd870f00c-6b7f-4324-accb-d38e7ba53b5c'
WHERE etablissement_id IS NULL;

-- Drop the old single-column unique constraint
ALTER TABLE rapports_soiree DROP CONSTRAINT IF EXISTS rapports_soiree_date_soiree_key;

-- Add composite unique constraint scoped per etablissement
ALTER TABLE rapports_soiree
  ADD CONSTRAINT rapports_soiree_etablissement_date_key
  UNIQUE (etablissement_id, date_soiree);
