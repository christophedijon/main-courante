/*
# Journal d'audit du registre et des événements (ajout uniquement)

## Résumé
Ajoute une trace automatique de chaque création, modification et suppression sur les événements, le registre de sécurité et les tables liées. Aucun droit existant n'est retiré, aucun écran ni aucune règle d'envoi ne change.

## Nouvelles tables
- `registre_audit` : une ligne par écriture (table, identifiant de la ligne, établissement, action, ancienne et nouvelle valeur, colonnes modifiées, auteur `auth.uid()` ou NULL pour la clé de service, rôle de l'appelant, horodatage serveur).
- `registre_audit_erreurs` : erreurs survenues pendant l'écriture du journal. Elles n'empêchent jamais la saisie. Visible uniquement par le super administrateur de réseau.

## Fonctions
- `registre_audit_capture` : déclencheur SECURITY DEFINER, search_path fixé. Les valeurs texte de plus de 10 Ko (par exemple images en base64) sont remplacées par leur empreinte MD5 et leur taille.
- `registre_audit_compacter` : utilitaire de la fonction ci-dessus.
- `proteger_identite_ligne` : refuse la modification de id, etablissement_id et created_at, sauf pour les rôles de maintenance (postgres, supabase_admin, service_role).

## Déclencheurs
- AFTER INSERT / UPDATE / DELETE sur evenements, registre_securite, evenement_medias, event_commentaires, registre_historique, registre_signatures.
- BEFORE UPDATE sur evenements et registre_securite (garde d'identité).

## Sécurité
- registre_audit : lecture réservée à la Direction de l'établissement concerné (fonction Direction dans managed_users). Aucun droit INSERT, UPDATE, DELETE, TRUNCATE pour anon et authenticated ; toutes les privilèges par défaut sont révoqués explicitement.
- Les fonctions ne sont pas exécutables par PUBLIC, anon ni authenticated.
- Aucune politique existante n'est modifiée.

## Notes
1. Les écritures de la clé de service sont journalisées avec auteur NULL.
2. Pour evenement_medias (sans établissement), l'établissement est lu sur l'événement parent.
*/

CREATE TABLE IF NOT EXISTS public.registre_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid,
  etablissement_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  colonnes_modifiees text[],
  auteur_id uuid,
  role_appelant text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registre_audit_etab_date_idx ON public.registre_audit (etablissement_id, created_at);
CREATE INDEX IF NOT EXISTS registre_audit_row_idx ON public.registre_audit (table_name, row_id);

CREATE TABLE IF NOT EXISTS public.registre_audit_erreurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text,
  action text,
  row_id uuid,
  erreur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registre_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registre_audit_erreurs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.registre_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.registre_audit_erreurs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.registre_audit TO authenticated;
GRANT SELECT ON public.registre_audit_erreurs TO authenticated;

DROP POLICY IF EXISTS "direction_lit_audit_de_son_etab" ON public.registre_audit;
CREATE POLICY "direction_lit_audit_de_son_etab" ON public.registre_audit
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.managed_users mu
    WHERE mu.auth_user_id = auth.uid()
      AND mu.fonction = 'Direction'
      AND mu.etablissement_id = registre_audit.etablissement_id
  ));

DROP POLICY IF EXISTS "mega_admin_lit_erreurs_audit" ON public.registre_audit_erreurs;
CREATE POLICY "mega_admin_lit_erreurs_audit" ON public.registre_audit_erreurs
  FOR SELECT TO authenticated
  USING (public.is_mega_admin());

CREATE OR REPLACE FUNCTION public.registre_audit_compacter(j jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN j IS NULL THEN NULL ELSE (
    SELECT COALESCE(jsonb_object_agg(
      key,
      CASE
        WHEN jsonb_typeof(value) = 'string' AND length(value #>> '{}') > 10240
          THEN jsonb_build_object('hash', md5(value #>> '{}'), 'taille', length(value #>> '{}'))
        ELSE value
      END
    ), '{}'::jsonb)
    FROM jsonb_each(j)
  ) END
$$;

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
BEGIN
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
      cols, auth.uid(), current_user::text
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

CREATE OR REPLACE FUNCTION public.proteger_identite_ligne()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.etablissement_id IS DISTINCT FROM OLD.etablissement_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Modification interdite des colonnes id, etablissement_id ou created_at'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registre_audit_capture() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registre_audit_compacter(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proteger_identite_ligne() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_evenements ON public.evenements;
CREATE TRIGGER audit_evenements AFTER INSERT OR UPDATE OR DELETE ON public.evenements
  FOR EACH ROW EXECUTE FUNCTION public.registre_audit_capture();

DROP TRIGGER IF EXISTS audit_registre_securite ON public.registre_securite;
CREATE TRIGGER audit_registre_securite AFTER INSERT OR UPDATE OR DELETE ON public.registre_securite
  FOR EACH ROW EXECUTE FUNCTION public.registre_audit_capture();

DROP TRIGGER IF EXISTS audit_evenement_medias ON public.evenement_medias;
CREATE TRIGGER audit_evenement_medias AFTER INSERT OR UPDATE OR DELETE ON public.evenement_medias
  FOR EACH ROW EXECUTE FUNCTION public.registre_audit_capture();

DROP TRIGGER IF EXISTS audit_event_commentaires ON public.event_commentaires;
CREATE TRIGGER audit_event_commentaires AFTER INSERT OR UPDATE OR DELETE ON public.event_commentaires
  FOR EACH ROW EXECUTE FUNCTION public.registre_audit_capture();

DROP TRIGGER IF EXISTS audit_registre_historique ON public.registre_historique;
CREATE TRIGGER audit_registre_historique AFTER INSERT OR UPDATE OR DELETE ON public.registre_historique
  FOR EACH ROW EXECUTE FUNCTION public.registre_audit_capture();

DROP TRIGGER IF EXISTS audit_registre_signatures ON public.registre_signatures;
CREATE TRIGGER audit_registre_signatures AFTER INSERT OR UPDATE OR DELETE ON public.registre_signatures
  FOR EACH ROW EXECUTE FUNCTION public.registre_audit_capture();

DROP TRIGGER IF EXISTS garde_identite_evenements ON public.evenements;
CREATE TRIGGER garde_identite_evenements BEFORE UPDATE ON public.evenements
  FOR EACH ROW EXECUTE FUNCTION public.proteger_identite_ligne();

DROP TRIGGER IF EXISTS garde_identite_registre_securite ON public.registre_securite;
CREATE TRIGGER garde_identite_registre_securite BEFORE UPDATE ON public.registre_securite
  FOR EACH ROW EXECUTE FUNCTION public.proteger_identite_ligne();
