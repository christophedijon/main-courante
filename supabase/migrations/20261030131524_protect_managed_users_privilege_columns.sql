/*
# Protege les colonnes de privilege de managed_users

1. Ce qui change
- Nouvelle fonction de declencheur `protect_managed_users_privileges()`.
- Nouveau declencheur BEFORE INSERT OR UPDATE sur `managed_users`.

2. Regles
- Refus d'accorder `is_super_admin = true` a une ligne (INSERT ou UPDATE).
- Refus de modifier `is_super_admin`, `etablissement_id` ou `auth_user_id` (UPDATE).
- Exemptions : super administrateur existant (evalue sur l'etat avant modification), cle de service (service_role) et sessions sans JWT (migrations, SQL Editor).

3. Securite
- Fonction SECURITY DEFINER avec search_path fixe.
- EXECUTE retire a PUBLIC, anon et authenticated (le declencheur est declenche par Postgres).

4. Notes
- Les colonnes `fonction` et `status` ne sont pas touchees par cette migration.
- Aucune donnee n'est modifiee par cette migration.
*/

CREATE OR REPLACE FUNCTION public.protect_managed_users_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_super_admin IS TRUE THEN
      RAISE EXCEPTION 'Seul un super administrateur peut accorder le statut super administrateur'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier le statut super administrateur'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.etablissement_id IS DISTINCT FROM OLD.etablissement_id THEN
      RAISE EXCEPTION 'Seul un super administrateur peut changer le rattachement d''un etablissement'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier le compte d''authentification lie'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_managed_users_privileges() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_managed_users_privileges ON public.managed_users;
CREATE TRIGGER trg_protect_managed_users_privileges
  BEFORE INSERT OR UPDATE ON public.managed_users
  FOR EACH ROW EXECUTE FUNCTION public.protect_managed_users_privileges();
