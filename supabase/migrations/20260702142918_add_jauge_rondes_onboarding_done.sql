ALTER TABLE etablissements
  ADD COLUMN IF NOT EXISTS jauge_onboarding_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rondes_onboarding_done boolean NOT NULL DEFAULT false;

-- Établissements ayant déjà configuré la jauge (mode défini)
UPDATE etablissements SET jauge_onboarding_done = true
WHERE mode_jauge IS NOT NULL AND mode_jauge != 'sortie';

-- Établissements ayant déjà au moins une ronde
UPDATE etablissements SET rondes_onboarding_done = true
WHERE EXISTS (
  SELECT 1 FROM rondes_config rc
  WHERE rc.etablissement_id = etablissements.id
);
