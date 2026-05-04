/*
  # Fix all remaining RLS policies using auth.users subquery

  ## Problem
  Several policies used `SELECT email FROM auth.users WHERE id = auth.uid()`
  which is inaccessible from the client context.

  ## Fix
  Replace with auth.email() built-in function on:
  - ia_settings (SELECT, INSERT, UPDATE)

  postes and assignations were already fixed in the previous migration.
*/

-- ─── IA_SETTINGS ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admins can view ia settings" ON public.ia_settings;
DROP POLICY IF EXISTS "Super admins can insert ia settings" ON public.ia_settings;
DROP POLICY IF EXISTS "Super admins can update ia settings" ON public.ia_settings;

CREATE POLICY "Super admins can view ia settings"
  ON public.ia_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "Super admins can insert ia settings"
  ON public.ia_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );

CREATE POLICY "Super admins can update ia settings"
  ON public.ia_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = auth.email()
    )
  );
