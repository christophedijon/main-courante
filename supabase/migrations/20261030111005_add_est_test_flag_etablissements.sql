/*
# Ajout de l'indicateur "établissement de test" (est_test)

1. Changements
- Nouvelle colonne `etablissements.est_test` (boolean, NOT NULL, défaut false).
- Passe à true pour "Le Test" (08863af3-...) et "sarl boite" (2cae4b7a-...), les deux établissements de test de l'éditeur.
- Nouveau déclencheur BEFORE UPDATE OF est_test : refuse toute modification de la valeur sauf pour un super administrateur, la clé de service ou une migration.

2. Sécurité
- Aucune politique RLS ni grant modifié.
- Un Direction d'établissement qui tente de modifier est_test reçoit une erreur 42501, même si la mise à jour est autorisée par ailleurs.

3. Notes
- Le déclencheur est SECURITY INVOKER : current_user reflète bien l'appelant (authenticated, anon, service_role ou postgres).
- Les autres colonnes d'etablissements ne sont pas concernées.
*/

ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS est_test boolean NOT NULL DEFAULT false;

UPDATE etablissements
SET est_test = true
WHERE id IN ('08863af3-a1e2-4b90-a6c4-c2863f017494', '2cae4b7a-10d2-4d73-b545-86337585f4dc')
  AND est_test = false;

CREATE OR REPLACE FUNCTION public.proteger_est_test()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.est_test IS DISTINCT FROM OLD.est_test THEN
    IF current_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier est_test'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proteger_est_test() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_proteger_est_test ON etablissements;
CREATE TRIGGER trg_proteger_est_test
BEFORE UPDATE OF est_test ON etablissements
FOR EACH ROW
EXECUTE FUNCTION public.proteger_est_test();
