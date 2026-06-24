-- Fix: registre_signatures — self-sign only, append-only, server-side name fill

-- 1. Drop the open INSERT policy
DROP POLICY IF EXISTS "registre_signatures_insert" ON registre_signatures;

-- 2. Restrictive INSERT: a user may only insert a row where signataire_id = their own auth.uid()
CREATE POLICY "registre_signatures_insert_self" ON registre_signatures
  FOR INSERT TO authenticated
  WITH CHECK (signataire_id = auth.uid());

-- 3. No UPDATE allowed (append-only audit trail)
DROP POLICY IF EXISTS "registre_signatures_update" ON registre_signatures;
CREATE POLICY "registre_signatures_no_update" ON registre_signatures
  FOR UPDATE TO authenticated
  USING (false);

-- 4. No DELETE allowed (append-only audit trail)
DROP POLICY IF EXISTS "registre_signatures_delete" ON registre_signatures;
CREATE POLICY "registre_signatures_no_delete" ON registre_signatures
  FOR DELETE TO authenticated
  USING (false);

-- 5. Keep SELECT open to all authenticated users (audit trail readability)
DROP POLICY IF EXISTS "registre_signatures_select" ON registre_signatures;
CREATE POLICY "registre_signatures_select" ON registre_signatures
  FOR SELECT TO authenticated
  USING (true);

-- 6. Trigger: overwrite signataire_nom and signataire_role from the real profile
--    so the client cannot forge those fields
CREATE OR REPLACE FUNCTION public.fill_signature_user_data()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prenom  text;
  v_nom     text;
  v_role    text;
BEGIN
  SELECT prenom, nom
    INTO v_prenom, v_nom
    FROM public.user_profiles
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  SELECT fonction
    INTO v_role
    FROM public.managed_users
   WHERE auth_user_id = auth.uid()
   LIMIT 1;

  NEW.signataire_nom  := COALESCE(TRIM(COALESCE(v_prenom,'') || ' ' || COALESCE(v_nom,'')), NEW.signataire_nom);
  NEW.signataire_role := COALESCE(v_role, NEW.signataire_role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registre_signatures_fill_user_data ON registre_signatures;
CREATE TRIGGER registre_signatures_fill_user_data
  BEFORE INSERT ON registre_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_signature_user_data();
