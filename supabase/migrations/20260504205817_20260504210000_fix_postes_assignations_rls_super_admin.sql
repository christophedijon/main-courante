/*
  # Fix RLS policies for postes and assignations

  ## Problem
  The INSERT/UPDATE/DELETE policies on postes and assignations only check
  managed_users.fonction IN ('Direction', 'Chef de poste'), but super admins
  stored with is_super_admin = true may have a different fonction value.
  Adding is_super_admin = true as an additional allowed condition fixes this.

  ## Changes
  - Drop and recreate INSERT/UPDATE/DELETE policies on postes and assignations
    to also allow users where managed_users.is_super_admin = true
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
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can update postes"
  ON public.postes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can delete postes"
  ON public.postes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
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
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can update assignations"
  ON public.assignations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can delete assignations"
  ON public.assignations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND (
          fonction IN ('Direction', 'Chef de poste')
          OR is_super_admin = true
        )
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
