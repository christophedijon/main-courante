-- Fix 1: creer_client_brouillon — start at etape 0 with step 'welcome'
CREATE OR REPLACE FUNCTION public.creer_client_brouillon()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_etab_id       uuid;
  v_partenaire_id uuid;
BEGIN
  SELECT id INTO v_partenaire_id
  FROM partenaires
  WHERE user_id = auth.uid()
  LIMIT 1;

  INSERT INTO etablissements (
    nom, partenaire_id, plan, statut, onboarding_etape, onboarding_step, onboarding_complete
  )
  VALUES (
    'Nouvel établissement',
    v_partenaire_id,
    'light',
    'brouillon',
    0,
    'welcome',
    false
  )
  RETURNING id INTO v_etab_id;

  RETURN v_etab_id;
END;
$$;

-- Fix 2: Allow Direction users to UPDATE their own etablissement
--        (needed for saveStep / onboarding progression writes)
CREATE POLICY "direction_update_own_etablissement"
ON public.etablissements
FOR UPDATE
TO authenticated
USING  (id = get_user_etablissement_id())
WITH CHECK (id = get_user_etablissement_id());

-- Fix 3: Patch the existing test etab so it starts at step 0
UPDATE public.etablissements
SET onboarding_etape = 0,
    onboarding_step  = 'welcome'
WHERE id = 'c94924d6-c236-49ab-b253-91d92fa4949b'
  AND onboarding_step IS DISTINCT FROM 'done';
