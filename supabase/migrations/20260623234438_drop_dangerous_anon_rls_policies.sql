-- Drop all anon-accessible policies on sensitive tables
DROP POLICY IF EXISTS "Editor anon can read ia_settings" ON ia_settings;
DROP POLICY IF EXISTS "Editor anon can read super_admins" ON super_admins;
DROP POLICY IF EXISTS "Editor anon can read user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Editor anon can read managed_users" ON managed_users;
DROP POLICY IF EXISTS "Editor anon can read company_documents" ON company_documents;
DROP POLICY IF EXISTS "Editor anon can read evacuation_plans" ON evacuation_plans;

-- Also drop broader anon policies that expose config/contact data
DROP POLICY IF EXISTS "editor_anon_read_email_rules" ON email_rules;
DROP POLICY IF EXISTS "editor_anon_read_entreprise" ON entreprise;
DROP POLICY IF EXISTS "editor_anon_read_toolbox" ON toolbox_documents;
