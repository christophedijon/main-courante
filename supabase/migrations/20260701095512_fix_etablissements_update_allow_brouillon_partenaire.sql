-- La policy direction_update_own_etablissement ne couvre que les établissements
-- déjà liés à l'user via get_user_etablissement_id().
-- Pendant l'onboarding, le brouillon est lié via partenaires.user_id,
-- pas encore via managed_users — donc la policy rejetait silencieusement.
-- On remplace la policy pour couvrir les deux cas.

DROP POLICY IF EXISTS "direction_update_own_etablissement" ON public.etablissements;

CREATE POLICY "direction_update_own_etablissement"
ON public.etablissements
FOR UPDATE
TO authenticated
USING (
  id = get_user_etablissement_id()
  OR partenaire_id IN (
    SELECT id FROM partenaires WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  id = get_user_etablissement_id()
  OR partenaire_id IN (
    SELECT id FROM partenaires WHERE user_id = auth.uid()
  )
);
