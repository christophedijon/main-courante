ALTER TABLE etablissements
  ADD COLUMN IF NOT EXISTS onboarding_step text
    CHECK (onboarding_step IN (
      'welcome', 'coordonnees', 'categorie_erp',
      'direction', 'materiel', 'logo', 'recap', 'done'
    ))
    DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Mark all existing etablissements as done so they aren't forced through the new flow
UPDATE etablissements
SET
  onboarding_step          = 'done',
  onboarding_completed_at  = COALESCE(onboarding_completed_at, created_at, now())
WHERE onboarding_completed_at IS NULL;
