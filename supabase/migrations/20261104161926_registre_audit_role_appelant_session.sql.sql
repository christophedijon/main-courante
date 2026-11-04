/*
# Correction du rôle enregistré dans le journal d'audit

## Résumé
Dans le journal d'audit, le rôle de l'appelant était lu avec current_user. Or la fonction de journalisation s'exécute avec les droits de son propriétaire, donc current_user vaut toujours postgres. Le rôle réel (anon, authenticated, service_role) est désormais lu dans le paramètre de session `role`, avec repli sur l'utilisateur de connexion.

## Modifications
- `registre_audit_capture` : le champ role_appelant utilise le rôle réel de l'appelant. Aucun autre changement.

## Sécurité
- Aucune politique, aucun droit et aucune garde d'identité ne change.

## Notes
1. Le champ est purement informatif ; l'auteur reste auth.uid().
*/

CREATE OR REPLACE FUNCTION public.registre_audit_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_j jsonb;
  new_j jsonb;
  etab uuid;
  rid uuid;
  cols text[];
  appelant text;
BEGIN
  appelant := COALESCE(NULLIF(NULLIF(current_setting('role', true), ''), 'none'), session_user);
  BEGIN
    IF TG_OP <> 'INSERT' THEN old_j := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN new_j := to_jsonb(NEW); END IF;

    rid := COALESCE(new_j->>'id', old_j->>'id')::uuid;
    etab := COALESCE(new_j->>'etablissement_id', old_j->>'etablissement_id')::uuid;
    IF etab IS NULL AND TG_TABLE_NAME = 'evenement_medias' THEN
      SELECT e.etablissement_id INTO etab
      FROM public.evenements e
      WHERE e.id = COALESCE(new_j->>'evenement_id', old_j->>'evenement_id')::uuid;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      SELECT array_agg(c ORDER BY c) INTO cols
      FROM (SELECT jsonb_object_keys(old_j || new_j) AS c) k
      WHERE (old_j -> c) IS DISTINCT FROM (new_j -> c);
    END IF;

    INSERT INTO public.registre_audit (
      table_name, row_id, etablissement_id, action,
      ancienne_valeur, nouvelle_valeur, colonnes_modifiees, auteur_id, role_appelant
    ) VALUES (
      TG_TABLE_NAME, rid, etab, TG_OP,
      public.registre_audit_compacter(old_j), public.registre_audit_compacter(new_j),
      cols, auth.uid(), appelant
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.registre_audit_erreurs (table_name, action, row_id, erreur)
      VALUES (TG_TABLE_NAME, TG_OP, rid, SQLERRM);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'registre_audit: journalisation impossible (%)', SQLERRM;
    END;
  END;
  RETURN NULL;
END;
$$;
