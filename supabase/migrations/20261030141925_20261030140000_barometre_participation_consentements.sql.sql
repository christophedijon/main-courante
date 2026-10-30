/*
# Baromètre réseau : interrupteur de participation et journal des changements

1. Nouveaux objets
- Colonne `etablissements.barometre_participe` (boolean, NOT NULL, défaut true) : l'établissement participe au baromètre réseau.
- Table `barometre_consentements` : une ligne par changement de l'interrupteur (ancienne valeur, nouvelle valeur, auteur, date).
- Fonction `journaliser_barometre_consentement()` et déclencheur `trg_journaliser_barometre_consentement`.

2. Sécurité
- Table `barometre_consentements` : RLS activé. Lecture (SELECT) uniquement pour la Direction de l'établissement concerné, SuperAdmin exclu.
- Écriture : aucune politique ouverte. Les politiques INSERT, UPDATE et DELETE refusent tout (clause false). Seul le déclencheur écrit dans la table.
- Droits de table : SELECT accordé à `authenticated` uniquement. Aucun droit pour `anon`.
- Déclencheur : avant tout changement de `barometre_participe`, il vérifie l'appelant. Autorisés : la Direction de cet établissement, un SuperAdmin, ou la clé de service (ou une connexion interne sans jeton). Tout autre appelant reçoit une erreur 42501 et le changement est annulé.
- La fonction du déclencheur n'est pas exécutable par `PUBLIC`, `anon` ni `authenticated`.

3. Notes importantes
- Aucune table existante, aucune politique existante et aucun rapport de soirée n'est modifié.
- La colonne a une valeur par défaut true : les établissements existants participent au baromètre tant que la Direction ne les désactive pas.
- Suppression d'un établissement : son historique de consentements est supprimé avec lui (ON DELETE CASCADE). À confirmer avant publication si cet historique doit être conservé.
*/

ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS barometre_participe boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.barometre_consentements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  ancienne_valeur boolean NOT NULL,
  nouvelle_valeur boolean NOT NULL,
  modifie_par uuid,
  modifie_le timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS barometre_consentements_etablissement_idx
  ON public.barometre_consentements (etablissement_id, modifie_le DESC);

ALTER TABLE public.barometre_consentements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.barometre_consentements FROM PUBLIC, anon;
GRANT SELECT ON public.barometre_consentements TO authenticated;

DROP POLICY IF EXISTS "direction_lit_consentements_barometre" ON public.barometre_consentements;
CREATE POLICY "direction_lit_consentements_barometre"
ON public.barometre_consentements FOR SELECT
TO authenticated
USING (
  NOT public.is_super_admin()
  AND EXISTS (
    SELECT 1 FROM public.managed_users mu
    WHERE mu.auth_user_id = auth.uid()
      AND mu.etablissement_id = barometre_consentements.etablissement_id
      AND mu.fonction = 'Direction'
  )
);

DROP POLICY IF EXISTS "consentements_barometre_insert_refuse" ON public.barometre_consentements;
CREATE POLICY "consentements_barometre_insert_refuse"
ON public.barometre_consentements FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "consentements_barometre_update_refuse" ON public.barometre_consentements;
CREATE POLICY "consentements_barometre_update_refuse"
ON public.barometre_consentements FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "consentements_barometre_delete_refuse" ON public.barometre_consentements;
CREATE POLICY "consentements_barometre_delete_refuse"
ON public.barometre_consentements FOR DELETE
TO authenticated
USING (false);

CREATE OR REPLACE FUNCTION public.journaliser_barometre_consentement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_autorise boolean;
BEGIN
  IF NEW.barometre_participe IS NOT DISTINCT FROM OLD.barometre_participe THEN
    RETURN NEW;
  END IF;

  v_autorise := auth.role() IS NULL
    OR auth.role() = 'service_role'
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.managed_users mu
      WHERE mu.auth_user_id = auth.uid()
        AND mu.etablissement_id = NEW.id
        AND mu.fonction = 'Direction'
    );

  IF NOT v_autorise THEN
    RAISE EXCEPTION 'Seule la Direction de cet établissement peut modifier la participation au baromètre'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.barometre_consentements (etablissement_id, ancienne_valeur, nouvelle_valeur, modifie_par)
  VALUES (NEW.id, OLD.barometre_participe, NEW.barometre_participe, auth.uid());

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.journaliser_barometre_consentement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_journaliser_barometre_consentement ON public.etablissements;
CREATE TRIGGER trg_journaliser_barometre_consentement
BEFORE UPDATE OF barometre_participe ON public.etablissements
FOR EACH ROW
EXECUTE FUNCTION public.journaliser_barometre_consentement();
