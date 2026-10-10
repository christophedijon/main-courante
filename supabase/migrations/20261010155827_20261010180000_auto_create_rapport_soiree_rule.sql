/*
# Auto-create rapport_soiree email rule on establishment creation

## Purpose
When a new establishment is created (INSERT on etablissements), automatically
create a default email_rules row for type='rapport_soiree' with:
- active = true
- dest_direction = true (Direction receives the report by default)
- all other recipient flags = false
- dest_emails_libres = empty array

## How it works
A SECURITY DEFINER trigger function runs AFTER INSERT ON etablissements.
It uses INSERT ... ON CONFLICT (etablissement_id, type) DO NOTHING to be
idempotent — safe to re-run, won't fail if a rule already exists (e.g. if
the onboarding flow already created one).

The function is wrapped in a BEGIN/EXCEPTION block so that if the email_rules
insert fails for any reason, the etablissement insert still succeeds — the
error is logged but does not block establishment creation.

## Security
- Function is SECURITY DEFINER with search_path = 'public' so it can insert
  into email_rules regardless of the caller's RLS context (the caller may be
  a super_admin or onboarding flow that isn't a Direction user yet).
- The trigger only fires on INSERT, never on UPDATE or DELETE.
*/

CREATE OR REPLACE FUNCTION public.auto_create_rapport_soiree_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    INSERT INTO email_rules (etablissement_id, type, active, dest_direction, dest_chef_de_poste, dest_agent_securite, dest_serveur, dest_emails_libres)
    VALUES (NEW.id, 'rapport_soiree', true, true, false, false, false, ARRAY[]::text[])
    ON CONFLICT (etablissement_id, type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't block establishment creation
    RAISE NOTICE 'auto_create_rapport_soiree_rule: failed for etab %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_auto_create_rapport_soiree_rule ON etablissements;

CREATE TRIGGER trg_auto_create_rapport_soiree_rule
  AFTER INSERT ON etablissements
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_rapport_soiree_rule();
