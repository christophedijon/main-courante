ALTER TABLE etablissements
ADD COLUMN IF NOT EXISTS registre_onboarding_done boolean NOT NULL DEFAULT false;

UPDATE etablissements et
SET registre_onboarding_done = true
WHERE EXISTS (
  SELECT 1 FROM registre_securite rs
  WHERE rs.etablissement_id = et.id
);
