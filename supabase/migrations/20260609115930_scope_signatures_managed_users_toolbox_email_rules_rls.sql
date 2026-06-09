
-- ============================================================
-- Fix signatures RLS — scope by etablissement_id
-- ============================================================
DROP POLICY IF EXISTS "signatures_select" ON signatures;
DROP POLICY IF EXISTS "signatures_insert" ON signatures;
DROP POLICY IF EXISTS "signatures_update" ON signatures;

CREATE POLICY "signatures_select_own_etab" ON signatures FOR SELECT TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "signatures_insert_own_etab" ON signatures FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "signatures_update_own_etab" ON signatures FOR UPDATE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin())
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

-- ============================================================
-- Fix managed_users RLS — scope super admin access by etab
-- ============================================================
DROP POLICY IF EXISTS "Super admins can read managed users" ON managed_users;
DROP POLICY IF EXISTS "Super admins can insert managed users" ON managed_users;
DROP POLICY IF EXISTS "Super admins can update managed users" ON managed_users;
DROP POLICY IF EXISTS "Super admins can delete managed users" ON managed_users;

CREATE POLICY "admins_select_own_etab_managed_users" ON managed_users FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR etablissement_id = get_user_etablissement_id()
    OR is_mega_admin()
  );

CREATE POLICY "admins_insert_own_etab_managed_users" ON managed_users FOR INSERT TO authenticated
  WITH CHECK (
    etablissement_id = get_user_etablissement_id()
    OR is_mega_admin()
  );

CREATE POLICY "admins_update_own_etab_managed_users" ON managed_users FOR UPDATE TO authenticated
  USING (
    etablissement_id = get_user_etablissement_id()
    OR is_mega_admin()
  )
  WITH CHECK (
    etablissement_id = get_user_etablissement_id()
    OR is_mega_admin()
  );

CREATE POLICY "admins_delete_own_etab_managed_users" ON managed_users FOR DELETE TO authenticated
  USING (
    etablissement_id = get_user_etablissement_id()
    OR is_mega_admin()
  );

-- ============================================================
-- Fix toolbox_documents RLS
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read active toolbox documents" ON toolbox_documents;
DROP POLICY IF EXISTS "Super admins can select toolbox documents" ON toolbox_documents;
DROP POLICY IF EXISTS "Super admins can insert toolbox documents" ON toolbox_documents;
DROP POLICY IF EXISTS "Super admins can update toolbox documents" ON toolbox_documents;
DROP POLICY IF EXISTS "Super admins can delete toolbox documents" ON toolbox_documents;

CREATE POLICY "toolbox_select_own_etab" ON toolbox_documents FOR SELECT TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "toolbox_insert_own_etab" ON toolbox_documents FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "toolbox_update_own_etab" ON toolbox_documents FOR UPDATE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin())
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "toolbox_delete_own_etab" ON toolbox_documents FOR DELETE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

-- Keep editor anon read for toolbox
DROP POLICY IF EXISTS "Editor anon can read toolbox_documents" ON toolbox_documents;
CREATE POLICY "editor_anon_read_toolbox" ON toolbox_documents FOR SELECT
  USING ((auth.jwt() ->> 'role'::text) = 'anon'::text);

-- ============================================================
-- Fix email_rules RLS — scope by etablissement_id
-- ============================================================
DROP POLICY IF EXISTS "Super admins can select email_rules" ON email_rules;
DROP POLICY IF EXISTS "Super admins can insert email_rules" ON email_rules;
DROP POLICY IF EXISTS "Super admins can update email_rules" ON email_rules;
DROP POLICY IF EXISTS "Super admins can delete email_rules" ON email_rules;

CREATE POLICY "email_rules_select_own_etab" ON email_rules FOR SELECT TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "email_rules_insert_own_etab" ON email_rules FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "email_rules_update_own_etab" ON email_rules FOR UPDATE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin())
  WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

CREATE POLICY "email_rules_delete_own_etab" ON email_rules FOR DELETE TO authenticated
  USING (etablissement_id = get_user_etablissement_id() OR is_mega_admin());

-- Keep editor anon read for email_rules
DROP POLICY IF EXISTS "Editor anon can read email_rules" ON email_rules;
CREATE POLICY "editor_anon_read_email_rules" ON email_rules FOR SELECT
  USING ((auth.jwt() ->> 'role'::text) = 'anon'::text);
