/*
  # Fix RLS policies to use auth.email() instead of querying auth.users

  ## Problem
  Previous policies used a subquery `SELECT email FROM auth.users WHERE id = auth.uid()`
  to compare against super_admins.email. This subquery accesses auth.users which is
  not permitted from the client context, causing "permission denied for table users".

  ## Fix
  Replace all occurrences of:
    (SELECT email FROM auth.users WHERE id = auth.uid())
  with:
    auth.email()

  This built-in function returns the authenticated user's email without
  requiring a direct query on auth.users.

  ## Affected tables
  - postes (INSERT, UPDATE, DELETE)
  - assignations (INSERT, UPDATE, DELETE)
*/

-- ─── POSTES ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can insert postes" ON public.postes;
DROP POLICY IF EXISTS "Admins can update postes" ON public.postes;
DROP POLICY IF EXISTS "Admins can delete postes" ON public.postes;

CREATE POLICY "Admins can insert postes"
  ON public.postes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "Admins can update postes"
  ON public.postes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "Admins can delete postes"
  ON public.postes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );

-- ─── ASSIGNATIONS ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can insert assignations" ON public.assignations;
DROP POLICY IF EXISTS "Admins can update assignations" ON public.assignations;
DROP POLICY IF EXISTS "Admins can delete assignations" ON public.assignations;

CREATE POLICY "Admins can insert assignations"
  ON public.assignations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "Admins can update assignations"
  ON public.assignations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "Admins can delete assignations"
  ON public.assignations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (fonction IN ('Direction', 'Chef de poste') OR is_super_admin = true)
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );
